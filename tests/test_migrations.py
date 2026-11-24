"""The Alembic migrations must build the same tables the app expects."""
from __future__ import annotations

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app import config


def test_migrations_create_all_tables(tmp_path, monkeypatch):
    db_url = f"sqlite:///{tmp_path / 'migrated.db'}"
    monkeypatch.setattr(config, "DATABASE_URL", db_url)

    command.upgrade(Config("alembic.ini"), "head")

    insp = inspect(create_engine(db_url))
    assert {"tickets", "audit_events"} <= set(insp.get_table_names())
    columns = {c["name"] for c in insp.get_columns("tickets")}
    assert {"priority", "status", "team", "flags", "language",
            "reply_status", "suggested_reply", "reply_sources", "final_reply"} <= columns
