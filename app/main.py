"""Triage Desk API: an AI support inbox for online stores."""
from __future__ import annotations

import logging
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from . import config, service
from .db import get_db
from .faq import FaqIndex, get_faq_index
from .llm import Classifier, ClassifierUnavailable, Drafter, get_classifier, get_drafter
from .models import Ticket
from .rules import TEAMS
from .schemas import ApproveReplyIn, EnquiryIn, ReviewIn, Stats, TicketDetail, TicketOut

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


app = FastAPI(title="Triage Desk API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model": config.GROQ_MODEL,
            "prompt_version": config.PROMPT_VERSION}


@app.post("/api/enquiries", response_model=TicketOut, status_code=201)
def create_enquiry(
    data: EnquiryIn,
    db: Session = Depends(get_db),
    classifier: Classifier = Depends(get_classifier),
) -> Ticket:
    return service.create_ticket(db, data, classifier)


@app.get("/api/tickets", response_model=list[TicketOut])
def list_tickets(
    status: str | None = None,
    team: str | None = None,
    priority: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Ticket]:
    # High-priority tickets first, then newest first.
    high_first = case((Ticket.priority == "high", 0), else_=1)
    q = select(Ticket).order_by(high_first, Ticket.id.desc()).limit(limit)
    if status:
        q = q.where(Ticket.status == status)
    if team:
        q = q.where(Ticket.team == team)
    if priority:
        q = q.where(Ticket.priority == priority)
    return list(db.scalars(q))


@app.get("/api/tickets/{ticket_id}", response_model=TicketDetail)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return ticket


@app.post("/api/tickets/{ticket_id}/review", response_model=TicketDetail)
def review(ticket_id: int, data: ReviewIn, db: Session = Depends(get_db)) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if data.team and data.team not in TEAMS:
        raise HTTPException(status_code=422, detail=f"Unknown team. Use one of: {TEAMS}")
    return service.review_ticket(db, ticket, data)


def _get_or_404(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return ticket


@app.post("/api/tickets/{ticket_id}/suggest-reply", response_model=TicketDetail)
def suggest_reply(
    ticket_id: int,
    db: Session = Depends(get_db),
    drafter: Drafter = Depends(get_drafter),
    faq: FaqIndex = Depends(get_faq_index),
) -> Ticket:
    ticket = _get_or_404(db, ticket_id)
    try:
        return service.suggest_reply(db, ticket, drafter, faq)
    except ClassifierUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail="The AI service is busy or unavailable right now. Please try again.",
        ) from exc


@app.post("/api/tickets/{ticket_id}/reply/approve", response_model=TicketDetail)
def approve_reply(ticket_id: int, data: ApproveReplyIn,
                  db: Session = Depends(get_db)) -> Ticket:
    ticket = _get_or_404(db, ticket_id)
    if ticket.reply_status == "none" and not data.final_text:
        raise HTTPException(status_code=409,
                            detail="No draft yet. Generate a suggested reply or write one.")
    return service.approve_reply(db, ticket, data)


@app.get("/api/faq")
def list_faq(faq: FaqIndex = Depends(get_faq_index)) -> list[dict]:
    return [{"id": e.id, "question": e.question, "answer": e.answer} for e in faq.entries]


@app.get("/api/stats", response_model=Stats)
def get_stats(db: Session = Depends(get_db)) -> Stats:
    return service.stats(db)


@app.get("/api/teams")
def get_teams() -> list[str]:
    return TEAMS
