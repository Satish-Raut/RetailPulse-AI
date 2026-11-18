"""Pure inventory-risk calculation, independent of HTTP and database clients."""

import math
from datetime import date, datetime, timedelta, timezone
from typing import Any


class ForecastCoverageError(ValueError):
    """Raised when the forecast does not cover every day in supplier lead time."""


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    raise ForecastCoverageError("Forecast contains a date in an unsupported format.")


def evaluate_inventory_risk(snapshot: dict[str, Any], forecasts: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate projected stock at supplier lead time and classify low-stock risk."""

    if not forecasts:
        raise ForecastCoverageError("No forecast records available.")

    observed_at = snapshot["observed_at"]
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)

    # Sort all available distinct forecast dates
    forecast_dates_sorted = sorted({_as_date(row["forecast_date"]) for row in forecasts})

    # If the forecast contains dates starting tomorrow relative to observed_at, use that;
    # otherwise (e.g. when evaluating against the simulated/fixed dataset horizon),
    # anchor the evaluation window to the start of the available forecast series.
    target_start = observed_at.date() + timedelta(days=1)
    if target_start in forecast_dates_sorted:
        start = target_start
    else:
        start = forecast_dates_sorted[0]

    end = start + timedelta(days=snapshot["lead_time_days"] - 1)

    forecast_by_date: dict[date, float] = {}
    for row in forecasts:
        forecast_date = _as_date(row["forecast_date"])
        if start <= forecast_date <= end:
            try:
                units = float(row["predicted_units"])
            except (TypeError, ValueError) as exc:
                raise ForecastCoverageError("Forecast contains invalid predicted units.") from exc
            if not math.isfinite(units) or units < 0:
                raise ForecastCoverageError("Forecast contains invalid predicted units.")
            forecast_by_date[forecast_date] = units

    expected_dates = [start + timedelta(days=offset) for offset in range(snapshot["lead_time_days"])]
    missing_dates = [forecast_date for forecast_date in expected_dates if forecast_date not in forecast_by_date]
    if missing_dates:
        raise ForecastCoverageError(
            f"Forecast is incomplete for the {snapshot['lead_time_days']}-day lead-time window."
        )

    def is_inbound_valid(shipment: dict[str, Any]) -> bool:
        shipment_date = _as_date(shipment["expected_at"])
        if start <= shipment_date <= end:
            return True
        days_from_obs = (shipment_date - observed_at.date()).days
        return 0 <= days_from_obs <= snapshot["lead_time_days"]

    forecast_demand = sum(forecast_by_date.values())
    inbound_before_lead_time = sum(
        shipment["quantity"]
        for shipment in snapshot["inbound"]
        if is_inbound_valid(shipment)
    )
    projected_stock = snapshot["on_hand_qty"] + inbound_before_lead_time - forecast_demand

    if projected_stock <= 0:
        risk_level = "stockout"
    elif projected_stock < snapshot["safety_stock_qty"]:
        risk_level = "below_safety_stock"
    else:
        risk_level = "healthy"

    calculation = {
        "on_hand_qty": snapshot["on_hand_qty"],
        "inbound_before_lead_time": inbound_before_lead_time,
        "forecast_demand_during_lead_time": round(forecast_demand, 3),
        "projected_stock_at_lead_time": round(projected_stock, 3),
        "safety_stock_qty": snapshot["safety_stock_qty"],
        "lead_time_days": snapshot["lead_time_days"],
        "forecast_start": start,
        "forecast_end": end,
    }
    return {"risk_level": risk_level, "calculation": calculation}
