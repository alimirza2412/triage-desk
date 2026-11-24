"""Request/response shapes and the strict format the AI must return."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import config

Intent = Literal[
    "order_status", "refund_request", "return_exchange", "product_question",
    "delivery_issue", "payment_issue", "complaint", "other",
]
Urgency = Literal["low", "medium", "high"]
Sentiment = Literal["positive", "neutral", "negative"]
Language = Literal["english", "urdu", "roman_urdu", "mixed", "other"]
Status = Literal["routed", "needs_review", "needs_info", "closed"]


class Classification(BaseModel):
    """The AI's output. Anything that does not match this shape is rejected."""

    intent: Intent
    urgency: Urgency
    sentiment: Sentiment
    language: Language
    confidence: float = Field(ge=0.0, le=1.0)
    order_id: str | None = Field(default=None, max_length=60)
    summary: str = Field(max_length=300)

    @field_validator("order_id")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        return v.strip() or None if v else None


class EnquiryIn(BaseModel):
    message: str = Field(min_length=1, max_length=config.MAX_MESSAGE_CHARS)
    customer_name: str | None = Field(default=None, max_length=120)
    customer_contact: str | None = Field(default=None, max_length=120)
    channel: Literal["web", "email", "whatsapp", "api"] = "web"

    @field_validator("message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message cannot be blank")
        return v.strip()


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    event: str
    actor: str
    details: dict


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    channel: str
    customer_name: str | None
    customer_contact: str | None
    message: str
    intent: str | None
    urgency: str | None
    sentiment: str | None
    language: str | None
    confidence: float | None
    order_id: str | None
    summary: str | None
    team: str
    status: str
    flags: list[str]


class TicketDetail(TicketOut):
    events: list[AuditEventOut]


class ReviewIn(BaseModel):
    action: Literal["approve", "reroute", "close"]
    reviewer: str = Field(min_length=1, max_length=80)
    team: str | None = None
    intent: Intent | None = None
    note: str | None = Field(default=None, max_length=500)


class Stats(BaseModel):
    total: int
    by_status: dict[str, int]
    by_intent: dict[str, int]
    by_language: dict[str, int]
    by_team: dict[str, int]
