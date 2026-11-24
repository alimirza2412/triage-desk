"""API tests for Triage Desk.

The real Groq classifier is replaced by a fake that returns whatever each test
needs, and the database is an in-memory SQLite, so the suite needs no API key
or internet.

Run from the project root:
    python -m pytest -q
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.llm import ClassifierUnavailable, get_classifier
from app.main import app
from app.schemas import Classification


class FakeClassifier:
    model_name = "fake-model"

    def __init__(self, result: Classification | Exception):
        self.result = result

    def classify(self, message: str) -> Classification:
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def make(**overrides) -> Classification:
    base = dict(intent="product_question", urgency="low", sentiment="neutral",
                language="english", confidence=0.95, order_id=None,
                summary="Customer asks about a product.")
    base.update(overrides)
    return Classification(**base)


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


def use(result):
    app.dependency_overrides[get_classifier] = lambda: FakeClassifier(result)


def post(client, message="Is this shirt available in medium size?"):
    return client.post("/api/enquiries", json={"message": message})


# --------------------------------------------------------------------------- #
# Routing
# --------------------------------------------------------------------------- #
def test_clear_question_is_auto_routed(client):
    use(make())
    res = post(client)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "routed"
    assert body["team"] == "Product"
    assert body["flags"] == []


def test_low_confidence_goes_to_review(client):
    use(make(confidence=0.4))
    body = post(client).json()
    assert body["status"] == "needs_review"
    assert "low_confidence" in body["flags"]


def test_refund_always_needs_human_approval(client):
    use(make(intent="refund_request", confidence=0.99))
    body = post(client, "Mujhe refund chahiye, order 4521").json()
    assert body["status"] == "needs_review"
    assert body["team"] == "Refunds & Returns"
    assert "refund_needs_approval" in body["flags"]


def test_angry_urgent_keeps_owning_team_but_raises_priority(client):
    # Found in the first real run: an upset customer must stay with the team
    # that can fix the problem, not be moved to Escalations.
    use(make(intent="payment_issue", sentiment="negative", urgency="high"))
    body = post(client, "Payment cut ho gayi lekin order confirm nahi hua").json()
    assert body["team"] == "Payments"
    assert body["priority"] == "high"
    assert body["status"] == "needs_review"
    assert "angry_and_urgent" in body["flags"]


def test_complaint_goes_to_escalations(client):
    use(make(intent="complaint", sentiment="negative", urgency="medium"))
    body = post(client, "Bohat bura experience tha").json()
    assert body["team"] == "Escalations"


def test_high_urgency_alone_raises_priority_without_review(client):
    use(make(intent="product_question", urgency="high", sentiment="neutral"))
    body = post(client, "Need to know today if this ships to Karachi").json()
    assert body["priority"] == "high"
    assert body["status"] == "routed"


def test_order_status_without_order_id_asks_for_info(client):
    use(make(intent="order_status"))
    body = post(client, "Where is my order?").json()
    assert body["status"] == "needs_info"
    assert "missing_order_id" in body["flags"]


def test_ai_down_keeps_message_and_sends_to_human(client):
    use(ClassifierUnavailable("AI service error"))
    res = post(client, "Hello, I need help")
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "needs_review"
    assert body["flags"] == ["ai_unavailable"]
    assert body["message"] == "Hello, I need help"


# --------------------------------------------------------------------------- #
# Input validation
# --------------------------------------------------------------------------- #
def test_blank_message_is_rejected(client):
    use(make())
    assert post(client, "   ").status_code == 422


def test_too_long_message_is_rejected(client):
    use(make())
    assert post(client, "a" * 5000).status_code == 422


# --------------------------------------------------------------------------- #
# Review, audit trail, listing, stats
# --------------------------------------------------------------------------- #
def test_review_reroute_is_recorded_in_audit_trail(client):
    use(make(confidence=0.5))
    tid = post(client).json()["id"]

    res = client.post(f"/api/tickets/{tid}/review",
                      json={"action": "reroute", "reviewer": "ali",
                            "intent": "payment_issue", "note": "It is a payment problem"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "routed"
    assert body["team"] == "Payments"

    events = [e["event"] for e in body["events"]]
    assert events == ["received", "classified", "flagged_for_review", "review_reroute"]
    assert body["events"][-1]["actor"] == "human:ali"
    assert body["events"][1]["details"]["prompt_version"]


def test_review_rejects_unknown_team(client):
    use(make(confidence=0.5))
    tid = post(client).json()["id"]
    res = client.post(f"/api/tickets/{tid}/review",
                      json={"action": "reroute", "reviewer": "ali", "team": "Marketing"})
    assert res.status_code == 422


def test_list_filters_by_status(client):
    use(make())
    post(client)
    use(make(confidence=0.3))
    post(client)
    res = client.get("/api/tickets", params={"status": "needs_review"})
    assert res.status_code == 200
    assert [t["status"] for t in res.json()] == ["needs_review"]


def test_list_puts_high_priority_first(client):
    use(make())
    post(client)
    use(make(urgency="high"))
    post(client)
    use(make())
    post(client)
    tickets = client.get("/api/tickets").json()
    assert tickets[0]["priority"] == "high"


def test_missing_ticket_returns_404(client):
    assert client.get("/api/tickets/999").status_code == 404


def test_stats_count_tickets(client):
    use(make(language="roman_urdu"))
    post(client)
    use(make(intent="refund_request", language="urdu"))
    post(client)
    s = client.get("/api/stats").json()
    assert s["total"] == 2
    assert s["by_status"] == {"routed": 1, "needs_review": 1}
    assert s["by_language"] == {"roman_urdu": 1, "urdu": 1}
    assert s["by_priority"] == {"normal": 2}
