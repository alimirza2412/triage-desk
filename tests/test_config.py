from app.config import _normalise_db_url


def test_hosted_postgres_urls_get_psycopg_driver():
    assert _normalise_db_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert _normalise_db_url("postgresql://u:p@h/db?sslmode=require") == "postgresql+psycopg://u:p@h/db?sslmode=require"


def test_other_urls_unchanged():
    assert _normalise_db_url("sqlite:///./triage.db") == "sqlite:///./triage.db"
    assert _normalise_db_url("postgresql+psycopg://u@h/db") == "postgresql+psycopg://u@h/db"
