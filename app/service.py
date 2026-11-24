"""The intake pipeline: save the message, classify it, apply rules, audit."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import config
from .faq import FaqIndex
from .llm import Classifier, ClassifierUnavailable, Drafter
from .models import AuditEvent, Ticket
from .rules import TEAM_BY_INTENT, decide
from .schemas import ApproveReplyIn, EnquiryIn, ReviewIn, Stats


def _audit(db: Session, ticket: Ticket, event: str, actor: str, **details) -> None:
    db.add(AuditEvent(ticket=ticket, event=event, actor=actor, details=details))


def create_ticket(db: Session, data: EnquiryIn, classifier: Classifier) -> Ticket:
    ticket = Ticket(
        channel=data.channel,
        customer_name=data.customer_name,
        customer_contact=data.customer_contact,
        message=data.message,
    )
    db.add(ticket)
    _audit(db, ticket, "received", "system", channel=data.channel)

    try:
        c = classifier.classify(data.message)
    except ClassifierUnavailable as exc:
        # Never lose a customer message: keep it and send it to a human.
        ticket.team = "General"
        ticket.status = "needs_review"
        ticket.priority = "normal"
        ticket.flags = ["ai_unavailable"]
        _audit(db, ticket, "ai_failed", "system", error=str(exc))
        _audit(db, ticket, "flagged_for_review", "rules", flags=ticket.flags)
        db.commit()
        db.refresh(ticket)
        return ticket

    ticket.intent = c.intent
    ticket.urgency = c.urgency
    ticket.sentiment = c.sentiment
    ticket.language = c.language
    ticket.confidence = c.confidence
    ticket.order_id = c.order_id
    ticket.summary = c.summary
    _audit(db, ticket, "classified", f"ai:{classifier.model_name}",
           prompt_version=config.PROMPT_VERSION, **c.model_dump())

    d = decide(c)
    ticket.team, ticket.status = d.team, d.status
    ticket.priority, ticket.flags = d.priority, d.flags
    event = {"routed": "routed", "needs_review": "flagged_for_review",
             "needs_info": "needs_info"}[d.status]
    _audit(db, ticket, event, "rules", team=d.team, priority=d.priority, flags=d.flags,
           threshold=config.REVIEW_CONFIDENCE_THRESHOLD)

    db.commit()
    db.refresh(ticket)
    return ticket


def review_ticket(db: Session, ticket: Ticket, data: ReviewIn) -> Ticket:
    before = {"team": ticket.team, "intent": ticket.intent, "status": ticket.status}
    if data.action == "close":
        ticket.status = "closed"
    else:
        if data.intent:
            ticket.intent = data.intent
            if not data.team:
                ticket.team = TEAM_BY_INTENT[data.intent]
        if data.team:
            ticket.team = data.team
        ticket.status = "routed"
    _audit(db, ticket, f"review_{data.action}", f"human:{data.reviewer}",
           before=before,
           after={"team": ticket.team, "intent": ticket.intent, "status": ticket.status},
           note=data.note)
    db.commit()
    db.refresh(ticket)
    return ticket


def guess_language(text: str) -> str:
    """Fallback when the AI could not classify: Urdu script is easy to spot.

    Used only for the reply language, so an Urdu-script customer still gets an
    Urdu reply even if classification failed.
    """
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return "english"
    arabic_script = sum(1 for ch in letters if "\u0600" <= ch <= "\u06ff")
    return "urdu" if arabic_script / len(letters) > 0.5 else "english"


def suggest_reply(db: Session, ticket: Ticket, drafter: Drafter, faq: FaqIndex) -> Ticket:
    """Draft a reply from the store FAQ. Raises ClassifierUnavailable if the AI fails."""
    query = ticket.summary or ticket.message
    entries = faq.search(query, k=3, intent=ticket.intent)
    language = ticket.language or guess_language(ticket.message)
    draft = drafter.draft(ticket.message, language, entries)
    used = [e for e in entries if e.id in set(draft.used_faq_ids)]

    ticket.suggested_reply = draft.reply
    ticket.reply_sources = [{"id": e.id, "question": e.question, "answer": e.answer}
                            for e in used]
    ticket.reply_covered = draft.covered
    ticket.reply_status = "draft"
    _audit(db, ticket, "reply_drafted", f"ai:{drafter.model_name}",
           retrieved=[e.id for e in entries], used=draft.used_faq_ids,
           covered=draft.covered)
    db.commit()
    db.refresh(ticket)
    return ticket


def approve_reply(db: Session, ticket: Ticket, data: ApproveReplyIn) -> Ticket:
    final = data.final_text or ticket.suggested_reply
    edited = data.final_text is not None and data.final_text != ticket.suggested_reply
    ticket.final_reply = final
    ticket.reply_status = "approved"
    _audit(db, ticket, "reply_approved", f"human:{data.reviewer}", edited=edited)
    db.commit()
    db.refresh(ticket)
    return ticket


def _counts(db: Session, column) -> dict[str, int]:
    rows = db.execute(select(column, func.count()).group_by(column)).all()
    return {(k if k is not None else "unknown"): n for k, n in rows}


def stats(db: Session) -> Stats:
    return Stats(
        total=db.scalar(select(func.count()).select_from(Ticket)) or 0,
        by_status=_counts(db, Ticket.status),
        by_intent=_counts(db, Ticket.intent),
        by_language=_counts(db, Ticket.language),
        by_team=_counts(db, Ticket.team),
        by_priority=_counts(db, Ticket.priority),
    )
