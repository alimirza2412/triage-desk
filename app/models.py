"""Database tables: tickets and their audit trail."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now,
                                                 onupdate=_now)

    # What came in
    channel: Mapped[str] = mapped_column(String(20), default="web")
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    customer_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)
    message: Mapped[str] = mapped_column(Text)

    # What the AI understood (null if the AI was unavailable)
    intent: Mapped[str | None] = mapped_column(String(40), nullable=True)
    urgency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    sentiment: Mapped[str | None] = mapped_column(String(10), nullable=True)
    language: Mapped[str | None] = mapped_column(String(15), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    order_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # What the rules decided
    team: Mapped[str] = mapped_column(String(40), default="General")
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)
    priority: Mapped[str] = mapped_column(String(10), default="normal", index=True)
    flags: Mapped[list] = mapped_column(JSON, default=list)

    # Suggested reply (drafted on request, approved by a human)
    reply_status: Mapped[str] = mapped_column(String(20), default="none")
    suggested_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_sources: Mapped[list] = mapped_column(JSON, default=list)
    reply_covered: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    final_reply: Mapped[str | None] = mapped_column(Text, nullable=True)

    events: Mapped[list[AuditEvent]] = relationship(
        back_populates="ticket", order_by="AuditEvent.id", cascade="all, delete-orphan"
    )


class AuditEvent(Base):
    """One row per decision, so every ticket can be traced end to end."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    event: Mapped[str] = mapped_column(String(40))
    actor: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON, default=dict)

    ticket: Mapped[Ticket] = relationship(back_populates="events")
