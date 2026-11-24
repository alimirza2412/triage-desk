"""Triage Desk API: an AI support inbox for online stores."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config, service
from .db import Base, engine, get_db
from .llm import Classifier, get_classifier
from .models import Ticket
from .rules import TEAMS
from .schemas import EnquiryIn, ReviewIn, Stats, TicketDetail, TicketOut

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Triage Desk API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Ticket]:
    q = select(Ticket).order_by(Ticket.id.desc()).limit(limit)
    if status:
        q = q.where(Ticket.status == status)
    if team:
        q = q.where(Ticket.team == team)
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


@app.get("/api/stats", response_model=Stats)
def get_stats(db: Session = Depends(get_db)) -> Stats:
    return service.stats(db)


@app.get("/api/teams")
def get_teams() -> list[str]:
    return TEAMS
