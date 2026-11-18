"""MongoDB Atlas client configuration for operational application data."""

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class MongoDBConfigError(RuntimeError):
    """Raised when required MongoDB configuration is missing."""


@lru_cache(maxsize=1)
def _client_and_database() -> tuple[MongoClient, str]:
    uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DATABASE")
    if not uri:
        raise MongoDBConfigError("MONGODB_URI is not configured for the backend.")
    if not database_name:
        raise MongoDBConfigError("MONGODB_DATABASE is not configured for the backend.")

    return MongoClient(uri, serverSelectionTimeoutMS=5000), database_name


def get_mongodb_database() -> Database:
    client, database_name = _client_and_database()
    return client[database_name]
