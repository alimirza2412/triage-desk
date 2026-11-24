"""AI classification with Groq, validated against a strict Pydantic schema."""
from __future__ import annotations

import json
import logging
from typing import Protocol

from groq import APIError as GroqAPIError
from groq import Groq
from pydantic import ValidationError

from . import config
from .schemas import Classification

log = logging.getLogger("triage.llm")


class ClassifierUnavailable(Exception):
    """The AI could not give a valid answer (service down, or bad output twice)."""


class Classifier(Protocol):
    model_name: str

    def classify(self, message: str) -> Classification: ...


SYSTEM_PROMPT = """You triage customer messages for an online store in Pakistan.
Messages may be in English, Urdu (Urdu script) or Roman Urdu (Urdu written in
English letters), or a mix.

Return ONLY a JSON object with exactly these keys:
- "intent": one of order_status, refund_request, return_exchange,
  product_question, delivery_issue, payment_issue, complaint, other
- "urgency": one of low, medium, high
- "sentiment": one of positive, neutral, negative
- "language": one of english, urdu, roman_urdu, mixed, other
- "confidence": a number from 0 to 1, how sure you are about the intent
- "order_id": the order number if the customer gave one, otherwise null.
  Never invent an order number.
- "summary": one short English sentence describing what the customer wants

Rules:
- If the message asks for money back, the intent is refund_request.
- Use "complaint" only when the main point is dissatisfaction, not a request.
- If you are unsure, lower the confidence instead of guessing.
"""


class GroqClassifier:
    def __init__(self) -> None:
        if not config.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set. Copy .env.example to .env.")
        self.model_name = config.GROQ_MODEL
        self._client = Groq(
            api_key=config.GROQ_API_KEY,
            timeout=config.GROQ_TIMEOUT,
            max_retries=config.GROQ_MAX_RETRIES,
        )

    def _ask(self, message: str) -> str:
        resp = self._client.chat.completions.create(
            model=self.model_name,
            temperature=0.0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
        )
        return resp.choices[0].message.content or ""

    def classify(self, message: str) -> Classification:
        """Ask once; if the answer breaks the schema, ask once more, then give up."""
        last_error: Exception | None = None
        for attempt in (1, 2):
            try:
                raw = self._ask(message)
                return Classification.model_validate(json.loads(raw))
            except GroqAPIError as exc:
                log.warning("Groq unavailable: %s", exc)
                raise ClassifierUnavailable(f"AI service error: {type(exc).__name__}") from exc
            except (json.JSONDecodeError, ValidationError) as exc:
                log.warning("Invalid AI output on attempt %d: %s", attempt, exc)
                last_error = exc
        raise ClassifierUnavailable(f"AI returned invalid output twice: {last_error}")


_classifier: Classifier | None = None


def get_classifier() -> Classifier:
    global _classifier
    if _classifier is None:
        _classifier = GroqClassifier()
    return _classifier
