import unittest
from datetime import date, datetime, timezone
from unittest.mock import patch

from bson import ObjectId
from fastapi.testclient import TestClient

from main import app
from src.data.mongodb_client import MongoDBConfigError
from src.inventory import router as inventory_router


class InventoryApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.database = object()

    def test_inventory_evaluation_response_serializes_mongo_ids(self):
        snapshot_id = ObjectId()
        alert_id = ObjectId()
        observed_at = datetime.now(timezone.utc)
        snapshot = {
            "_id": snapshot_id,
            "store_id": "S01",
            "product_id": "P004",
            "on_hand_qty": 12,
            "inbound": [],
            "lead_time_days": 2,
            "safety_stock_qty": 10,
            "source": "manual",
            "observed_at": observed_at,
            "created_at": observed_at,
        }
        calculation = {
            "on_hand_qty": 12,
            "inbound_before_lead_time": 0,
            "forecast_demand_during_lead_time": 8.0,
            "projected_stock_at_lead_time": 4.0,
            "safety_stock_qty": 10,
            "lead_time_days": 2,
            "forecast_start": date(2026, 1, 2),
            "forecast_end": date(2026, 1, 3),
        }
        alert = {
            "_id": alert_id,
            "store_id": "S01",
            "product_id": "P004",
            "snapshot_id": snapshot_id,
            "forecast_start": date(2026, 1, 2),
            "forecast_end": date(2026, 1, 3),
            "risk_level": "below_safety_stock",
            "calculation": calculation,
            "rule_version": "v1",
            "status": "open",
            "created_at": observed_at,
            "updated_at": observed_at,
        }
        result = {
            "snapshot": snapshot,
            "freshness": "current",
            "risk_level": "below_safety_stock",
            "explanation": "Projected stock is below safety stock.",
            "calculation": calculation,
            "alert": alert,
        }

        with (
            patch.object(inventory_router, "_database", return_value=self.database),
            patch.object(inventory_router.service, "evaluate_snapshot", return_value=result),
        ):
            response = self.client.post(
                "/inventory/evaluate",
                json={
                    "store_id": "S01",
                    "product_id": "P004",
                    "on_hand_qty": 12,
                    "lead_time_days": 2,
                    "safety_stock_qty": 10,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["snapshot"]["id"], str(snapshot_id))
        self.assertEqual(body["alert"]["id"], str(alert_id))
        self.assertEqual(body["alert"]["snapshot_id"], str(snapshot_id))
        self.assertEqual(body["risk_level"], "below_safety_stock")

    def test_invalid_inventory_quantity_is_rejected_before_database_access(self):
        with patch.object(inventory_router, "_database") as get_database:
            response = self.client.post(
                "/inventory/evaluate",
                json={
                    "store_id": "S01",
                    "product_id": "P004",
                    "on_hand_qty": -1,
                    "lead_time_days": 2,
                    "safety_stock_qty": 10,
                },
            )

        self.assertEqual(response.status_code, 422)
        get_database.assert_not_called()

    def test_missing_mongodb_configuration_returns_service_unavailable(self):
        with patch.object(
            inventory_router,
            "get_mongodb_database",
            side_effect=MongoDBConfigError("MONGODB_URI is not configured for the backend."),
        ):
            response = self.client.get("/inventory/alerts")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "MONGODB_URI is not configured for the backend.")


if __name__ == "__main__":
    unittest.main()
