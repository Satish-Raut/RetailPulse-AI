"""Build deterministic explanations for forecasts using their computed context."""

from typing import Any


def _fallback_explanation(context: dict[str, Any]) -> dict[str, Any]:
    """Build a templated explanation using only forecast context."""

    key_drivers = []
    if context["recent_actuals"].get("trend_28d") is not None:
        direction = "up" if context["recent_actuals"]["trend_28d"] >= 0 else "down"
        key_drivers.append(f"The 28-day sales trend is currently trending {direction}.")
    if context["promotion"]["promotion_flag"]:
        key_drivers.append("A promotion was active as of the most recent observed data.")
    if not key_drivers:
        key_drivers.append("Recent sales history and seasonality patterns.")

    risks = []
    if context["holidays_in_forecast_window"]:
        names = ", ".join(h["name"] for h in context["holidays_in_forecast_window"])
        risks.append(f"Holiday(s) fall within the forecast window ({names}), which may shift demand.")
    if not risks:
        risks.append("No specific risks identified from the available context.")

    change = context.get("vs_recent_history_pct_change")
    change_text = (
        f"{change:+.1f}% versus the trailing 28-day average"
        if change is not None
        else "an amount that couldn't be compared to recent history"
    )

    explanation = (
        f"Over the next {context['forecast_horizon_days']} days, the model predicts an average of "
        f"{context['avg_predicted_units']} units/day ({context['total_predicted_units']} total) for "
        f"product {context['product_id']} at store {context['store_id']}, {change_text}."
    )

    return {
        "explanation": explanation,
        "key_drivers": key_drivers,
        "risks_or_opportunities": risks,
        "recommendation": "Monitor actuals against this forecast and adjust inventory/staffing plans accordingly.",
    }


def generate_explanation(context: dict[str, Any], user_question: str | None = None) -> dict[str, Any]:
    """Build a forecast explanation from available data without an AI service."""

    return _fallback_explanation(context)
