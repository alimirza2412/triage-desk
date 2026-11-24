# Triage Desk

**An AI support inbox for online stores in Pakistan and the Gulf.**
Customer messages arrive in English, Urdu or Roman Urdu. Triage Desk reads each
one, works out what the customer wants, routes it to the right team, and sends
anything uncertain to a human, with a full audit trail of every decision.

> Status: in active development. Backend core done; review dashboard, suggested
> replies (RAG over the store FAQ), eval and deployment are next.

## How a message is handled

1. **Received:** saved immediately, so a customer message is never lost.
2. **Classified by AI:** intent, urgency, sentiment, language, order number and a
   one-line summary. The output must match a strict Pydantic schema; invalid
   output is retried once, then the ticket goes to a human.
3. **Routed by rules:** deterministic rules decide the team and status. The AI
   suggests; the rules decide.
4. **Audited:** every step (received, classified, routed, flagged, reviewed) is
   stored with the actor, the model and the prompt version.

### Rules

| Rule | Effect |
|---|---|
| AI confidence below 0.7 | Needs review (`low_confidence`) |
| Refund request | Always needs human approval (`refund_needs_approval`) |
| Negative sentiment and high urgency | Escalations team, needs review (`angry_and_urgent`) |
| Order or delivery question with no order number | Needs info (`missing_order_id`) |
| AI unavailable or invalid output twice | Kept, sent to a human (`ai_unavailable`) |

## API

| Method | Path | What it does |
|---|---|---|
| POST | `/api/enquiries` | Submit a customer message |
| GET | `/api/tickets?status=&team=` | List tickets |
| GET | `/api/tickets/{id}` | Ticket with its full audit trail |
| POST | `/api/tickets/{id}/review` | Human approves, reroutes or closes |
| GET | `/api/stats` | Counts by status, intent, language and team |
| GET | `/api/health` | Health, model and prompt version |

## Run locally

Requires Python 3.11.

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # then set GROQ_API_KEY
python -m uvicorn app.main:app --port 8000
```

API docs: <http://localhost:8000/docs>. Try it with sample messages:

```bash
python scripts/try_messages.py
```

## Tests

```bash
python -m pytest -q
```

18 tests. The AI and the database are replaced with fakes, so no API key or
internet is needed.

## Stack

FastAPI · SQLAlchemy 2 · PostgreSQL (SQLite locally) · Groq · Pydantic · pytest ·
GitHub Actions
