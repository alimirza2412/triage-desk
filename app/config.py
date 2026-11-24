"""All tunable settings, read from environment variables (or a .env file)."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()



def _normalise_db_url(url: str) -> str:
    """Hosted Postgres (Neon, Render) gives postgres:// URLs; SQLAlchemy needs the psycopg driver named."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL: str = _normalise_db_url(os.getenv("DATABASE_URL", "sqlite:///./triage.db"))

# Comma-separated list of dashboard URLs allowed to call the API ("*" allows any).
CORS_ORIGINS: list[str] = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_TIMEOUT: float = float(os.getenv("GROQ_TIMEOUT", "30"))
GROQ_MAX_RETRIES: int = int(os.getenv("GROQ_MAX_RETRIES", "2"))

# Bump this whenever the classification prompt changes, so the audit log
# shows which prompt produced each decision.
PROMPT_VERSION: str = "classify-v1"

# Below this confidence, a human must check the AI's decision.
REVIEW_CONFIDENCE_THRESHOLD: float = float(os.getenv("REVIEW_CONFIDENCE_THRESHOLD", "0.7"))

MAX_MESSAGE_CHARS: int = 4000
