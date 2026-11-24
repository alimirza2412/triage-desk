"""AI classification with Groq, validated against a strict Pydantic schema."""
from __future__ import annotations

import json
import logging
from typing import Protocol

from groq import APIError as GroqAPIError
from groq import Groq
from pydantic import ValidationError

from . import config
from .faq import FaqEntry
from .schemas import Classification, ReplyDraft

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


# --------------------------------------------------------------------------- #
# Suggested replies
# --------------------------------------------------------------------------- #
class Drafter(Protocol):
    model_name: str

    def draft(self, message: str, language: str | None,
              faq: list[FaqEntry]) -> ReplyDraft: ...


LANGUAGE_INSTRUCTION = {
    "english": "Reply in English.",
    "roman_urdu": "Reply in Roman Urdu (Urdu written in English letters), the way the customer wrote.",
    "urdu": "Reply in Urdu script.",
    "mixed": "Reply in the same mix of English and Roman Urdu the customer used.",
}

DRAFT_PROMPT = """You draft customer support replies for an online store in Pakistan.
A human agent will check your draft before it is sent.

Use ONLY the FAQ entries provided below. Rules:
- Never invent policies, prices, dates, order details or tracking numbers.
- Never promise a refund, replacement or compensation unless an FAQ entry says so,
  and then only on the conditions the FAQ states.
- If the FAQ entries do not answer the message, write a short, polite reply saying
  a team member will follow up, and set "covered" to false.
- Keep it under 80 words, warm and professional. Ask for the order number if the
  FAQ says it is needed and the customer did not give one.
- {language_instruction}

Return ONLY a JSON object with exactly these keys:
- "reply": the reply text
- "used_faq_ids": the ids of the FAQ entries you used (may be empty)
- "covered": true if the FAQ fully answers the message, otherwise false

FAQ entries:
{faq_block}"""


class GroqDrafter:
    def __init__(self) -> None:
        if not config.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set. Copy .env.example to .env.")
        self.model_name = config.GROQ_MODEL
        self._client = Groq(
            api_key=config.GROQ_API_KEY,
            timeout=config.GROQ_TIMEOUT,
            max_retries=config.GROQ_MAX_RETRIES,
        )

    def _ask(self, system: str, message: str) -> str:
        resp = self._client.chat.completions.create(
            model=self.model_name,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ],
        )
        return resp.choices[0].message.content or ""

    def draft(self, message: str, language: str | None,
              faq: list[FaqEntry]) -> ReplyDraft:
        faq_block = "\n".join(f"[{e.id}] Q: {e.question} A: {e.answer}" for e in faq) \
            or "(no matching FAQ entries)"
        system = DRAFT_PROMPT.format(
            language_instruction=LANGUAGE_INSTRUCTION.get(language or "", "Reply in English."),
            faq_block=faq_block,
        )
        allowed = {e.id for e in faq}
        last_error: Exception | None = None
        for attempt in (1, 2):
            try:
                draft = ReplyDraft.model_validate(json.loads(self._ask(system, message)))
            except GroqAPIError as exc:
                raise ClassifierUnavailable(f"AI service error: {type(exc).__name__}") from exc
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                continue
            # Guardrail: the reply may only cite FAQ entries it was actually given.
            unknown = set(draft.used_faq_ids) - allowed
            if unknown:
                last_error = ValueError(f"cited unknown FAQ ids: {sorted(unknown)}")
                log.warning("Draft attempt %d rejected: %s", attempt, last_error)
                continue
            return draft
        raise ClassifierUnavailable(f"AI returned an invalid draft twice: {last_error}")


_drafter: Drafter | None = None


def get_drafter() -> Drafter:
    global _drafter
    if _drafter is None:
        _drafter = GroqDrafter()
    return _drafter
