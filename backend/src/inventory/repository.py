"""Persistence operations for inventory snapshots, alerts, and actions."""

from datetime import date, datetime, timezone
from threading import Lock
from typing import Any, Optional

from bson import ObjectId
from pymongo.database import Database

_index_lock = Lock()
_indexed_databases: set[tuple[int, str]] = set()


def _normalize_for_mongo(value: Any) -> Any:
    """Recursively convert datetime.date objects to datetime.datetime for PyMongo BSON serialization."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if isinstance(value, dict):
        return {k: _normalize_for_mongo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_for_mongo(v) for v in value]
    return value


def ensure_indexes(database: Database) -> None:
    key = (id(database.client), database.name)
    if key in _indexed_databases:
        return
    with _index_lock:
        if key in _indexed_databases:
            return
        database.inventory_snapshots.create_index(
            [("store_id", 1), ("product_id", 1), ("observed_at", -1)],
            name="snapshot_store_product_observed",
        )
        database.inventory_alerts.create_index(
            [
                ("store_id", 1),
                ("product_id", 1),
                ("forecast_start", 1),
                ("forecast_end", 1),
                ("rule_version", 1),
            ],
            unique=True,
            name="alert_series_window_rule_unique",
        )
        database.inventory_alerts.create_index(
            [("status", 1), ("created_at", -1)],
            name="alert_status_created",
        )
        database.replenishment_actions.create_index(
            [("alert_id", 1), ("created_at", -1)],
            name="action_alert_created",
        )
        _indexed_databases.add(key)


def insert_snapshot(database: Database, snapshot: dict[str, Any]) -> dict[str, Any]:
    snapshot = _normalize_for_mongo(snapshot)
    document = {**snapshot, "created_at": datetime.now(timezone.utc)}
    result = database.inventory_snapshots.insert_one(document)
    return database.inventory_snapshots.find_one({"_id": result.inserted_id})


def list_snapshots(
    database: Database,
    store_id: Optional[str],
    product_id: Optional[str],
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    query: dict[str, Any] = {}
    if store_id:
        query["store_id"] = store_id
    if product_id:
        query["product_id"] = product_id
    return list(
        database.inventory_snapshots.find(query)
        .sort("observed_at", -1)
        .skip(offset)
        .limit(limit)
    )


def upsert_alert(database: Database, alert: dict[str, Any]) -> dict[str, Any]:
    alert = _normalize_for_mongo(alert)
    now = datetime.now(timezone.utc)
    key = {
        "store_id": alert["store_id"],
        "product_id": alert["product_id"],
        "forecast_start": alert["forecast_start"],
        "forecast_end": alert["forecast_end"],
        "rule_version": alert["rule_version"],
    }
    database.inventory_alerts.update_one(
        key,
        {
            "$set": {
                "snapshot_id": alert["snapshot_id"],
                "risk_level": alert["risk_level"],
                "calculation": alert["calculation"],
                "updated_at": now,
            },
            "$setOnInsert": {"status": "open", "created_at": now},
        },
        upsert=True,
    )
    return database.inventory_alerts.find_one(key)


def list_alerts(
    database: Database,
    store_id: Optional[str],
    product_id: Optional[str],
    status: Optional[str],
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    query: dict[str, Any] = {}
    if store_id:
        query["store_id"] = store_id
    if product_id:
        query["product_id"] = product_id
    if status:
        query["status"] = status
    return list(
        database.inventory_alerts.find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )


def find_alert(database: Database, alert_id: ObjectId) -> Optional[dict[str, Any]]:
    return database.inventory_alerts.find_one({"_id": alert_id})


def insert_action(
    database: Database, alert_id: ObjectId, action: dict[str, Any]
) -> dict[str, Any]:
    action = _normalize_for_mongo(action)
    now = datetime.now(timezone.utc)
    document = {**action, "alert_id": alert_id, "created_at": now}
    result = database.replenishment_actions.insert_one(document)
    database.inventory_alerts.update_one(
        {"_id": alert_id},
        {"$set": {"status": "reviewed", "updated_at": now}},
    )
    return database.replenishment_actions.find_one({"_id": result.inserted_id})


def list_actions(
    database: Database, alert_id: ObjectId, limit: int, offset: int
) -> list[dict[str, Any]]:
    return list(
        database.replenishment_actions.find({"alert_id": alert_id})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )


def count_actions(database: Database, alert_id: ObjectId) -> int:
    return database.replenishment_actions.count_documents({"alert_id": alert_id})


def to_object_id(value: str) -> Optional[ObjectId]:
    return ObjectId(value) if ObjectId.is_valid(value) else None
