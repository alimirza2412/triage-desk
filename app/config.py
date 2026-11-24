"""All tunable settings, read from environment variables (or a .env file)."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./triage.db")

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
