"""Shared Groq API client configuration."""

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqConfigError(RuntimeError):
    """Raised when required Groq configuration is missing."""


def get_model() -> str:
    model = os.getenv("GROQ_MODEL")
    if not model:
        raise GroqConfigError("GROQ_MODEL is not set. Add it to the backend .env file.")
    return model


def get_client() -> OpenAI:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise GroqConfigError("GROQ_API_KEY is not set. Add your Groq API key to the backend .env file.")

    return OpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
