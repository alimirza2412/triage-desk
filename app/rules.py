"""Deterministic routing rules. The AI suggests; these rules decide.

Every rule that fires is recorded as a flag, so the audit log shows exactly
why a ticket ended up where it did.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from . import config
from .schemas import Classification

TEAM_BY_INTENT: dict[str, str] = {
    "order_status": "Orders",
    "delivery_issue": "Orders",
    "refund_request": "Refunds & Returns",
    "return_exchange": "Refunds & Returns",
    "product_question": "Product",
    "payment_issue": "Payments",
    "complaint": "Escalations",
    "other": "General",
}

TEAMS: list[str] = sorted(set(TEAM_BY_INTENT.values()))


@dataclass
class Decision:
    team: str
    status: str
    priority: str = "normal"
    flags: list[str] = field(default_factory=list)


def decide(c: Classification) -> Decision:
    # The team always comes from the intent: the team that can actually fix the
    # problem keeps the ticket, even when the customer is upset.
    team = TEAM_BY_INTENT[c.intent]
    priority = "normal"
    flags: list[str] = []

    if c.confidence < config.REVIEW_CONFIDENCE_THRESHOLD:
        flags.append("low_confidence")

    if c.intent == "refund_request":
        # Money leaves the business: a human always confirms.
        flags.append("refund_needs_approval")

    if c.sentiment == "negative" and c.urgency == "high":
        # Raise priority and get a human to look, but do not move the ticket
        # away from the team that owns the problem.
        priority = "high"
        flags.append("angry_and_urgent")
    elif c.urgency == "high":
        priority = "high"

    if c.intent in {"order_status", "delivery_issue"} and not c.order_id:
        flags.append("missing_order_id")

    review_flags = {"low_confidence", "refund_needs_approval", "angry_and_urgent"}
    if review_flags.intersection(flags):
        status = "needs_review"
    elif "missing_order_id" in flags:
        status = "needs_info"
    else:
        status = "routed"

    return Decision(team=team, status=status, priority=priority, flags=flags)
