"""API schemas for the MongoDB-backed inventory workflow."""

from datetime import date, datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InboundShipment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity: int = Field(ge=0)
    expected_at: datetime

    @field_validator("expected_at")
    @classmethod
    def normalize_expected_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class InventorySnapshotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    store_id: str = Field(min_length=1, max_length=100)
    product_id: str = Field(min_length=1, max_length=100)
    on_hand_qty: int = Field(ge=0)
    inbound: list[InboundShipment] = Field(default_factory=list, max_length=100)
    lead_time_days: int = Field(ge=1, le=365)
    safety_stock_qty: int = Field(ge=0)
    source: str = Field(default="manual", min_length=1, max_length=100)
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("store_id", "product_id", "source")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value

    @field_validator("observed_at")
    @classmethod
    def normalize_observed_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        value = value.astimezone(timezone.utc)
        if value > datetime.now(timezone.utc):
            raise ValueError("observed_at cannot be in the future.")
        return value


class InventoryCalculation(BaseModel):
    on_hand_qty: int
    inbound_before_lead_time: int
    forecast_demand_during_lead_time: float
    projected_stock_at_lead_time: float
    safety_stock_qty: int
    lead_time_days: int
    forecast_start: date
    forecast_end: date


class InventorySnapshotResponse(BaseModel):
    id: str
    store_id: str
    product_id: str
    on_hand_qty: int
    inbound: list[InboundShipment]
    lead_time_days: int
    safety_stock_qty: int
    source: str
    observed_at: datetime
    created_at: datetime


class InventoryAlertResponse(BaseModel):
    id: str
    store_id: str
    product_id: str
    snapshot_id: str
    forecast_start: date
    forecast_end: date
    risk_level: Literal["stockout", "below_safety_stock"]
    calculation: InventoryCalculation
    rule_version: str
    status: Literal["open", "reviewed"]
    created_at: datetime
    updated_at: datetime


class InventoryEvaluationResponse(BaseModel):
    snapshot: InventorySnapshotResponse
    freshness: Literal["current", "stale"]
    risk_level: Literal["stockout", "below_safety_stock", "healthy", "unavailable"]
    explanation: str
    calculation: Optional[InventoryCalculation] = None
    alert: Optional[InventoryAlertResponse] = None


class InventorySnapshotListResponse(BaseModel):
    count: int
    results: list[InventorySnapshotResponse]


class InventoryAlertListResponse(BaseModel):
    count: int
    results: list[InventoryAlertResponse]


class ReplenishmentActionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["replenishment_planned", "no_action", "needs_review"]
    quantity_considered: Optional[int] = Field(default=None, ge=0)
    note: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class ReplenishmentActionResponse(BaseModel):
    id: str
    alert_id: str
    decision: Literal["replenishment_planned", "no_action", "needs_review"]
    quantity_considered: Optional[int] = None
    note: Optional[str] = None
    created_at: datetime


class ReplenishmentActionListResponse(BaseModel):
    count: int
    results: list[ReplenishmentActionResponse]


def serialize_inventory_document(document: dict[str, Any]) -> dict[str, Any]:
    """Convert MongoDB ObjectIds to strings for response validation."""

    serialized = dict(document)
    serialized["id"] = str(serialized.pop("_id"))
    if "snapshot_id" in serialized:
        serialized["snapshot_id"] = str(serialized["snapshot_id"])
    if "alert_id" in serialized:
        serialized["alert_id"] = str(serialized["alert_id"])
    return serialized
