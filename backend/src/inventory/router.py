"""HTTP endpoints for inventory snapshots, risk alerts, and reviewed actions."""

import logging
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pymongo.errors import PyMongoError

from src.data.mongodb_client import MongoDBConfigError, get_mongodb_database
from src.inventory import repository, service
from src.inventory.service import ForecastUnavailableError
from src.models.inventory import (
    InventoryAlertListResponse,
    InventoryAlertResponse,
    InventoryEvaluationResponse,
    InventorySnapshotCreate,
    InventorySnapshotListResponse,
    InventorySnapshotResponse,
    ReplenishmentActionCreate,
    ReplenishmentActionListResponse,
    ReplenishmentActionResponse,
    serialize_inventory_document,
)

logger = logging.getLogger("sales_forecasting_api.inventory")
router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _database():
    try:
        database = get_mongodb_database()
        repository.ensure_indexes(database)
        return database
    except MongoDBConfigError as exc:
        logger.error("MongoDB is not configured: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PyMongoError as exc:
        logger.exception("Could not connect to MongoDB")
        raise HTTPException(status_code=503, detail="Inventory database is unavailable.") from exc


def _object_id(value: str) -> ObjectId:
    object_id = repository.to_object_id(value)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid MongoDB document ID.")
    return object_id


@router.post(
    "/evaluate",
    response_model=InventoryEvaluationResponse,
    summary="Save an inventory snapshot and evaluate forecast risk",
)
def evaluate_inventory(request: InventorySnapshotCreate) -> InventoryEvaluationResponse:
    database = _database()
    try:
        result = service.evaluate_snapshot(database, request)
    except ForecastUnavailableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PyMongoError as exc:
        logger.exception("MongoDB operation failed during inventory evaluation")
        raise HTTPException(status_code=503, detail="Inventory database is unavailable.") from exc
    except RuntimeError as exc:
        logger.exception("Inventory configuration is invalid")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    result["snapshot"] = serialize_inventory_document(result["snapshot"])
    if result["alert"]:
        result["alert"] = serialize_inventory_document(result["alert"])
    return InventoryEvaluationResponse.model_validate(result)


@router.get(
    "/snapshots",
    response_model=InventorySnapshotListResponse,
    summary="List saved inventory snapshots",
)
def get_inventory_snapshots(
    store_id: Optional[str] = None,
    product_id: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> InventorySnapshotListResponse:
    database = _database()
    try:
        documents = repository.list_snapshots(database, store_id, product_id, limit, offset)
    except PyMongoError as exc:
        logger.exception("Could not list inventory snapshots")
        raise HTTPException(status_code=503, detail="Inventory database is unavailable.") from exc

    results = [InventorySnapshotResponse.model_validate(serialize_inventory_document(doc)) for doc in documents]
    return InventorySnapshotListResponse(count=len(results), results=results)


@router.get(
    "/alerts",
    response_model=InventoryAlertListResponse,
    summary="List inventory risk alerts",
)
def get_inventory_alerts(
    store_id: Optional[str] = None,
    product_id: Optional[str] = None,
    status: Optional[str] = Query(default=None, pattern="^(open|reviewed)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> InventoryAlertListResponse:
    database = _database()
    try:
        documents = repository.list_alerts(database, store_id, product_id, status, limit, offset)
    except PyMongoError as exc:
        logger.exception("Could not list inventory alerts")
        raise HTTPException(status_code=503, detail="Inventory database is unavailable.") from exc

    results = [InventoryAlertResponse.model_validate(serialize_inventory_document(doc)) for doc in documents]
    return InventoryAlertListResponse(count=len(results), results=results)


@router.post(
    "/alerts/{alert_id}/actions",
    response_model=ReplenishmentActionResponse,
    summary="Record a human-reviewed replenishment decision",
)
def create_replenishment_action(
    alert_id: str, request: ReplenishmentActionCreate
) -> ReplenishmentActionResponse:
    database = _database()
    object_id = _object_id(alert_id)
    try:
        if repository.find_alert(database, object_id) is None:
            raise HTTPException(status_code=404, detail="Inventory alert was not found.")
        document = repository.insert_action(database, object_id, request.model_dump())
    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("Could not save replenishment action for alert_id=%s", alert_id)
        raise HTTPException(status_code=503, detail="Inventory database is unavailable.") from exc
    return ReplenishmentActionResponse.model_validate(serialize_inventory_document(document))


@router.get(
    "/alerts/{alert_id}/actions",
    response_model=ReplenishmentActionListResponse,
    summary="List reviewed decisions for an inventory alert",
)
def get_replenishment_actions(
    alert_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ReplenishmentActionListResponse:
    database = _database()
    object_id = _object_id(alert_id)
    try:
        if repository.find_alert(database, object_id) is None:
            raise HTTPException(status_code=404, detail="Inventory alert was not found.")
        documents = repository.list_actions(database, object_id, limit, offset)
        count = repository.count_actions(database, object_id)
    except HTTPException:
        raise
    except PyMongoError as exc:
        logger.exception("Could not list replenishment actions for alert_id=%s", alert_id)
        raise HTTPException(status_code=503, detail="Inventory database is unavailable.") from exc

    results = [ReplenishmentActionResponse.model_validate(serialize_inventory_document(doc)) for doc in documents]
    return ReplenishmentActionListResponse(count=count, results=results)
