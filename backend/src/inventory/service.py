"""Orchestration for inventory persistence and Databricks-backed risk evaluation."""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from pymongo.database import Database

from src.data import db as databricks
from src.inventory import repository
from src.inventory.risk import ForecastCoverageError, evaluate_inventory_risk
from src.models.inventory import InventorySnapshotCreate

logger = logging.getLogger("sales_forecasting_api.inventory")
RISK_RULE_VERSION = "v1"


class ForecastUnavailableError(RuntimeError):
    """Raised when Databricks cannot provide a complete matching forecast."""


def _max_snapshot_age() -> timedelta:
    raw_hours = os.getenv("INVENTORY_MAX_AGE_HOURS", "24")
    try:
        hours = float(raw_hours)
    except ValueError as exc:
        raise RuntimeError("INVENTORY_MAX_AGE_HOURS must be a positive number.") from exc
    if hours <= 0:
        raise RuntimeError("INVENTORY_MAX_AGE_HOURS must be a positive number.")
    return timedelta(hours=hours)


def evaluate_snapshot(
    database: Database, request: InventorySnapshotCreate
) -> dict[str, Any]:
    snapshot = request.model_dump()
    observed_at = snapshot["observed_at"]
    now = datetime.now(timezone.utc)
    is_stale = now - observed_at > _max_snapshot_age()

    calculation = None
    risk_level = "unavailable"
    explanation = "This inventory snapshot is stale. Submit a current snapshot before evaluating risk."
    alert = None

    if not is_stale:
        try:
            forecast_rows = databricks.fetch_forecast_predictions(
                snapshot["product_id"], snapshot["store_id"]
            )
        except Exception as exc:
            logger.exception(
                "Databricks forecast lookup failed for inventory evaluation: product_id=%s store_id=%s",
                snapshot["product_id"],
                snapshot["store_id"],
            )
            raise ForecastUnavailableError("Forecast data is temporarily unavailable.") from exc

        if not forecast_rows:
            raise ForecastUnavailableError("No forecast is available for this product and store.")

        try:
            evaluation = evaluate_inventory_risk(snapshot, forecast_rows)
        except ForecastCoverageError as exc:
            raise ForecastUnavailableError(str(exc)) from exc

        calculation = evaluation["calculation"]
        risk_level = evaluation["risk_level"]
        projected = calculation["projected_stock_at_lead_time"]
        safety_stock = calculation["safety_stock_qty"]
        if risk_level == "stockout":
            explanation = (
                f"Projected stock at the end of the {calculation['lead_time_days']}-day supplier "
                f"lead time is {projected:g} units or fewer, indicating potential stockout risk."
            )
        elif risk_level == "below_safety_stock":
            explanation = (
                f"Projected stock is {projected:g} units, below the configured safety stock of "
                f"{safety_stock} units."
            )
        else:
            explanation = (
                f"Projected stock is {projected:g} units, at or above the configured safety stock "
                f"of {safety_stock} units."
            )

    snapshot_document = repository.insert_snapshot(database, snapshot)
    if risk_level in ("stockout", "below_safety_stock"):
        alert_document = repository.upsert_alert(
            database,
            {
                "store_id": snapshot["store_id"],
                "product_id": snapshot["product_id"],
                "snapshot_id": snapshot_document["_id"],
                "forecast_start": calculation["forecast_start"],
                "forecast_end": calculation["forecast_end"],
                "risk_level": risk_level,
                "calculation": calculation,
                "rule_version": RISK_RULE_VERSION,
            },
        )
        alert = alert_document

    return {
        "snapshot": snapshot_document,
        "freshness": "stale" if is_stale else "current",
        "risk_level": risk_level,
        "explanation": explanation,
        "calculation": calculation,
        "alert": alert,
    }
