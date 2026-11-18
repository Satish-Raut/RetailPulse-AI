import unittest
from datetime import datetime, timedelta, timezone

from src.inventory.risk import ForecastCoverageError, evaluate_inventory_risk


class InventoryRiskTests(unittest.TestCase):
    def setUp(self):
        self.observed_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.snapshot = {
            "observed_at": self.observed_at,
            "on_hand_qty": 100,
            "inbound": [],
            "lead_time_days": 3,
            "safety_stock_qty": 20,
        }
        self.forecasts = [
            {
                "forecast_date": self.observed_at.date() + timedelta(days=day),
                "predicted_units": 10,
            }
            for day in range(1, 4)
        ]

    def test_inventory_at_safety_threshold_is_healthy(self):
        self.snapshot["on_hand_qty"] = 50

        result = evaluate_inventory_risk(self.snapshot, self.forecasts)

        self.assertEqual(result["risk_level"], "healthy")
        self.assertEqual(result["calculation"]["projected_stock_at_lead_time"], 20)

    def test_inbound_within_lead_time_is_counted_but_later_inbound_is_not(self):
        self.snapshot["on_hand_qty"] = 40
        self.snapshot["inbound"] = [
            {"quantity": 5, "expected_at": self.observed_at + timedelta(days=2)},
            {"quantity": 100, "expected_at": self.observed_at + timedelta(days=4)},
        ]

        result = evaluate_inventory_risk(self.snapshot, self.forecasts)

        self.assertEqual(result["calculation"]["inbound_before_lead_time"], 5)
        self.assertEqual(result["calculation"]["projected_stock_at_lead_time"], 15)
        self.assertEqual(result["risk_level"], "below_safety_stock")

    def test_nonpositive_projected_stock_is_stockout_risk(self):
        self.snapshot["on_hand_qty"] = 20

        result = evaluate_inventory_risk(self.snapshot, self.forecasts)

        self.assertEqual(result["risk_level"], "stockout")
        self.assertLessEqual(result["calculation"]["projected_stock_at_lead_time"], 0)

    def test_incomplete_daily_forecast_is_rejected(self):
        with self.assertRaises(ForecastCoverageError):
            evaluate_inventory_risk(self.snapshot, self.forecasts[:-1])


if __name__ == "__main__":
    unittest.main()
