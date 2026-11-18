import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from bson import ObjectId

from src.inventory import service
from src.inventory.service import ForecastUnavailableError
from src.models.inventory import InventorySnapshotCreate


class InventoryServiceTests(unittest.TestCase):
    def setUp(self):
        self.database = object()
        self.request = InventorySnapshotCreate(
            store_id="S01",
            product_id="P004",
            on_hand_qty=29,
            lead_time_days=2,
            safety_stock_qty=10,
        )
        self.snapshot_document = {
            "_id": ObjectId(),
            **self.request.model_dump(),
            "created_at": datetime.now(timezone.utc),
        }

    def forecasts_for(self, observed_at, lead_time_days):
        return [
            {
                "forecast_date": observed_at.date() + timedelta(days=day),
                "predicted_units": 10,
            }
            for day in range(1, lead_time_days + 1)
        ]

    def test_saves_snapshot_and_persists_risk_alert(self):
        forecast_rows = self.forecasts_for(self.request.observed_at, self.request.lead_time_days)
        alert = {
            "_id": ObjectId(),
            "store_id": "S01",
            "product_id": "P004",
            "snapshot_id": self.snapshot_document["_id"],
            "forecast_start": forecast_rows[0]["forecast_date"],
            "forecast_end": forecast_rows[-1]["forecast_date"],
            "risk_level": "below_safety_stock",
            "calculation": {
                "on_hand_qty": 29,
                "inbound_before_lead_time": 0,
                "forecast_demand_during_lead_time": 20,
                "projected_stock_at_lead_time": 9,
                "safety_stock_qty": 10,
                "lead_time_days": 2,
                "forecast_start": forecast_rows[0]["forecast_date"],
                "forecast_end": forecast_rows[-1]["forecast_date"],
            },
            "rule_version": "v1",
            "status": "open",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        with (
            patch.object(service.databricks, "fetch_forecast_predictions", return_value=forecast_rows),
            patch.object(service.repository, "insert_snapshot", return_value=self.snapshot_document) as insert_snapshot,
            patch.object(service.repository, "upsert_alert", return_value=alert) as upsert_alert,
        ):
            result = service.evaluate_snapshot(self.database, self.request)

        self.assertEqual(result["risk_level"], "below_safety_stock")
        self.assertEqual(result["alert"], alert)
        insert_snapshot.assert_called_once()
        upsert_alert.assert_called_once()

    def test_stale_snapshot_is_saved_but_not_evaluated(self):
        stale_request = self.request.model_copy(
            update={"observed_at": datetime.now(timezone.utc) - timedelta(days=2)}
        )
        snapshot_document = {
            "_id": ObjectId(),
            **stale_request.model_dump(),
            "created_at": datetime.now(timezone.utc),
        }
        with (
            patch.object(service, "_max_snapshot_age", return_value=timedelta(hours=24)),
            patch.object(service.databricks, "fetch_forecast_predictions") as fetch_forecasts,
            patch.object(service.repository, "insert_snapshot", return_value=snapshot_document),
        ):
            result = service.evaluate_snapshot(self.database, stale_request)

        self.assertEqual(result["freshness"], "stale")
        self.assertEqual(result["risk_level"], "unavailable")
        self.assertIsNone(result["alert"])
        fetch_forecasts.assert_not_called()

    def test_missing_forecast_does_not_save_snapshot(self):
        with (
            patch.object(service.databricks, "fetch_forecast_predictions", return_value=[]),
            patch.object(service.repository, "insert_snapshot") as insert_snapshot,
        ):
            with self.assertRaises(ForecastUnavailableError):
                service.evaluate_snapshot(self.database, self.request)

        insert_snapshot.assert_not_called()


if __name__ == "__main__":
    unittest.main()
