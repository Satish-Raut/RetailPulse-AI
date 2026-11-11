"""Groq-backed free-text analytics chat."""

from typing import Any, Optional

from src.genai.chatbot import run_chat_with_completion

from .client import get_client, get_model


def run_chat(
    message: str,
    history: Optional[list[dict[str, str]]] = None,
    store_id: Optional[str] = None,
    store_name: Optional[str] = None,
) -> dict[str, Any]:
    """Run analytics tool-calling chat through the configured Groq model."""

    client = get_client()
    model = get_model()

    def chat_completion(messages, tools=None, json_mode=False):
        parameters: dict[str, Any] = {"model": model, "messages": messages}
        if tools:
            parameters["tools"] = tools
            parameters["tool_choice"] = "auto"
        if json_mode:
            parameters["response_format"] = {"type": "json_object"}

        response = client.chat.completions.create(**parameters)
        return response.choices[0].message

    return run_chat_with_completion(
        message,
        chat_completion,
        history=history,
        store_id=store_id,
        store_name=store_name,
    )
