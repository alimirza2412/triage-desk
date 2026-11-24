"""Suggested replies: FAQ search, drafting guardrails and the approval flow."""
from __future__ import annotations

import json

import pytest

from app import config
from app.faq import get_faq_index
from app.llm import ClassifierUnavailable, GroqDrafter, get_drafter
from app.main import app
from app.schemas import ReplyDraft
from tests.test_api import client, make, post, use  # noqa: F401  (shared fixture)


# --------------------------------------------------------------------------- #
# FAQ search
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("summary,intent,expected", [
    ("Customer wants a refund because the product arrived broken.", "refund_request",
     "damaged-item"),
    ("Payment was deducted but the order was not confirmed.", "payment_issue",
     "payment-deducted"),
    ("Customer wants to exchange shoes for a bigger size.", "return_exchange",
     "exchange-size"),
    ("Order placed three weeks ago has not arrived.", "delivery_issue", "order-late"),
    ("Customer asks if they ship to Dubai.", "other", "international-shipping"),
])
def test_faq_search_finds_the_right_entry(summary, intent, expected):
    ids = [e.id for e in get_faq_index().search(summary, k=3, intent=intent)]
    assert expected in ids


def test_faq_search_with_no_words_returns_nothing():
    assert get_faq_index().search("??? !!!") == []


# --------------------------------------------------------------------------- #
# Drafter guardrails (no real API calls)
# --------------------------------------------------------------------------- #
@pytest.fixture
def drafter(monkeypatch):
    monkeypatch.setattr(config, "GROQ_API_KEY", "test-key")
    return GroqDrafter()


def test_draft_rejects_citing_faq_it_was_not_given(drafter, monkeypatch):
    faq = get_faq_index().search("refund damaged", intent="refund_request")
    bad = {"reply": "Refund in 1 hour!", "used_faq_ids": ["made-up-policy"], "covered": True}
    monkeypatch.setattr(drafter, "_ask", lambda s, m: json.dumps(bad))
    with pytest.raises(ClassifierUnavailable):
        drafter.draft("refund chahiye", "roman_urdu", faq)


def test_draft_accepts_valid_citations(drafter, monkeypatch):
    faq = get_faq_index().search("refund damaged", intent="refund_request")
    good = {"reply": "Order number aur photos bhej dein.", "used_faq_ids": [faq[0].id],
            "covered": True}
    monkeypatch.setattr(drafter, "_ask", lambda s, m: json.dumps(good))
    assert drafter.draft("refund chahiye", "roman_urdu", faq).covered is True


def test_draft_prompt_asks_for_the_customers_language(drafter, monkeypatch):
    seen = {}

    def fake_ask(system, message):
        seen["system"] = system
        return json.dumps({"reply": "...", "used_faq_ids": [], "covered": False})

    monkeypatch.setattr(drafter, "_ask", fake_ask)
    drafter.draft("mera order?", "roman_urdu", [])
    assert "Roman Urdu" in seen["system"]
    assert "no matching FAQ entries" in seen["system"]


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
class FakeDrafter:
    model_name = "fake-model"

    def __init__(self, fail: bool = False):
        self.fail = fail

    def draft(self, message, language, faq):
        if self.fail:
            raise ClassifierUnavailable("down")
        return ReplyDraft(reply="Photos aur order number bhej dein.",
                          used_faq_ids=[faq[0].id] if faq else [], covered=bool(faq))


def test_suggest_then_approve_with_edit(client):  # noqa: F811
    use(make(intent="refund_request", language="roman_urdu",
             summary="Customer wants a refund because the product arrived broken."))
    tid = post(client, "Mujhe refund chahiye, product toot ke aaya hai").json()["id"]
    app.dependency_overrides[get_drafter] = lambda: FakeDrafter()

    res = client.post(f"/api/tickets/{tid}/suggest-reply")
    assert res.status_code == 200
    body = res.json()
    assert body["reply_status"] == "draft"
    assert body["reply_sources"][0]["id"] == "damaged-item"

    res = client.post(f"/api/tickets/{tid}/reply/approve",
                      json={"reviewer": "ali", "final_text": "Edited reply, shukriya!"})
    body = res.json()
    assert body["reply_status"] == "approved"
    assert body["final_reply"] == "Edited reply, shukriya!"
    last = body["events"][-1]
    assert last["event"] == "reply_approved"
    assert last["details"]["edited"] is True


def test_suggest_returns_503_when_ai_is_down(client):  # noqa: F811
    use(make())
    tid = post(client).json()["id"]
    app.dependency_overrides[get_drafter] = lambda: FakeDrafter(fail=True)
    assert client.post(f"/api/tickets/{tid}/suggest-reply").status_code == 503


def test_reply_language_falls_back_to_urdu_script_when_ai_failed(client):  # noqa: F811
    # Found in the first real run: an Urdu message hit a rate limit during
    # classification, and its drafted reply came back in English.
    from app.llm import ClassifierUnavailable as Down
    use(Down("rate limited"))
    tid = post(client, "میرا آرڈر 3344 ابھی تک نہیں پہنچا").json()["id"]
    seen = {}

    class SpyDrafter(FakeDrafter):
        def draft(self, message, language, faq):
            seen["language"] = language
            return super().draft(message, language, faq)

    app.dependency_overrides[get_drafter] = lambda: SpyDrafter()
    client.post(f"/api/tickets/{tid}/suggest-reply")
    assert seen["language"] == "urdu"


def test_guess_language():
    from app.service import guess_language
    assert guess_language("میرا آرڈر کہاں ہے") == "urdu"
    assert guess_language("Mera order kahan hai") == "english"
    assert guess_language("1234 !!") == "english"


def test_cannot_approve_without_a_draft_or_text(client):  # noqa: F811
    use(make())
    tid = post(client).json()["id"]
    res = client.post(f"/api/tickets/{tid}/reply/approve", json={"reviewer": "ali"})
    assert res.status_code == 409
