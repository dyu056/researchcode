"""
In-memory database for Literature Review Engine.
In production, replace with SQLite or PostgreSQL.
"""

from typing import Dict, Any

# In-memory database
database: Dict[str, Any] = {
    "trees": {}
}


def init_db():
    """Initialize database. Called on startup."""
    database["trees"] = {}
    print("Database initialized")


def get_db():
    """Get database reference."""
    return database
