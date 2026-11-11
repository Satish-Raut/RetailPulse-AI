"""Groq-backed narrative generation for existing forecasts."""

import json
import logging
from typing import Any, Optional

from src.genai.forecast_explainer import generate_explanation as generate_deterministic_explanation

from .client import get_client, get_model

logger = logging.getLogger("sales_forecasting_api.groq.explain")

SYSTEM_PROMPT = """You explain a sales forecast that has already been computed by an ML model.
Do not generate or change forecast numbers. Use only facts present in the JSON context.
Do not invent statistics, dates, percentages, or numbers. If the context cannot answer
the user's question, say so rather than guessing.

Return one JSON object with exactly these keys:
{
  "explanation": "plain language summary",
  "key_drivers": ["string"],
  "risks_or_opportunities": ["string"],
  "recommendation": "string"
}
Return nothing except the JSON object."""


def _validated_narrative(content: Optional[str]) -> Optional[dict[str, Any]]:
    try:
        parsed = json.loads(content or "")
    except (json.JSONDecodeError, TypeError):
        return None

    required = ("explanation", "key_drivers", "risks_or_opportunities", "recommendation")
    if not isinstance(parsed, dict) or any(key not in parsed for key in required):
        return None
    if not isinstance(parsed["explanation"], str) or not isinstance(parsed["recommendation"], str):
        return None
    if not isinstance(parsed["key_drivers"], list) or not isinstance(parsed["risks_or_opportunities"], list):
        return None

    return {
        "explanation": parsed["explanation"],
        "key_drivers": [str(item) for item in parsed["key_drivers"]],
        "risks_or_opportunities": [str(item) for item in parsed["risks_or_opportunities"]],
        "recommendation": parsed["recommendation"],
    }


def generate_explanation(context: dict[str, Any], user_question: Optional[str] = None) -> dict[str, Any]:
    """Generate an explanation using Groq, preserving a deterministic fallback."""

    client = get_client()
    model = get_model()
    question = (
        f"Answer this specific question using only the context: {user_question}"
        if user_question
        else "Provide a general explanation of this forecast."
    )
    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Forecast context:\n{json.dumps(context, indent=2, default=str)}\n\n{question}",
            },
        ],
    )

    narrative = _validated_narrative(response.choices[0].message.content)
    if narrative is None:
        logger.warning("Groq returned an invalid forecast explanation; using deterministic explanation.")
        return generate_deterministic_explanation(context)
    return narrative
