"""Tests for the classifier's output checking (no real API calls)."""
from __future__ import annotations

import json

import pytest

from app import config
from app.llm import ClassifierUnavailable, GroqClassifier

VALID = {
    "intent": "order_status", "urgency": "medium", "sentiment": "neutral",
    "language": "roman_urdu", "confidence": 0.9, "order_id": "1234",
    "summary": "Customer asks where order 1234 is.",
}


@pytest.fixture
def clf(monkeypatch):
    monkeypatch.setattr(config, "GROQ_API_KEY", "test-key")
    return GroqClassifier()


def test_valid_output_is_parsed(clf, monkeypatch):
    monkeypatch.setattr(clf, "_ask", lambda m: json.dumps(VALID))
    c = clf.classify("Mera order 1234 kahan hai?")
    assert c.intent == "order_status"
    assert c.order_id == "1234"


def test_retries_once_after_invalid_output(clf, monkeypatch):
    answers = iter(["not json", json.dumps(VALID)])
    monkeypatch.setattr(clf, "_ask", lambda m: next(answers))
    assert clf.classify("order 1234?").intent == "order_status"


def test_gives_up_after_two_invalid_outputs(clf, monkeypatch):
    bad = dict(VALID, intent="make_coffee")  # not an allowed intent
    monkeypatch.setattr(clf, "_ask", lambda m: json.dumps(bad))
    with pytest.raises(ClassifierUnavailable):
        clf.classify("hello")


def test_rejects_confidence_out_of_range(clf, monkeypatch):
    bad = dict(VALID, confidence=1.7)
    monkeypatch.setattr(clf, "_ask", lambda m: json.dumps(bad))
    with pytest.raises(ClassifierUnavailable):
        clf.classify("hello")


def test_blank_order_id_becomes_none(clf, monkeypatch):
    monkeypatch.setattr(clf, "_ask", lambda m: json.dumps(dict(VALID, order_id="  ")))
    assert clf.classify("hello").order_id is None
