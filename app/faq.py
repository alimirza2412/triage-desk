"""Store FAQ and keyword search (BM25).

The FAQ is small (under 20 entries), so BM25 keyword ranking is enough: it is
fast, needs no embedding model and keeps the app light enough for a 512 MB
server. Search runs on the AI's English summary of the message, so it works
the same for English, Urdu and Roman Urdu customers.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from rank_bm25 import BM25Okapi

FAQ_PATH = Path(__file__).resolve().parent.parent / "data" / "faq.json"

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "and", "or",
    "in", "on", "for", "my", "i", "me", "you", "your", "it", "this", "that",
    "do", "does", "can", "what", "how", "when", "with", "but", "not", "has",
    "have", "customer", "asks", "wants", "about", "their", "they", "s",
}


@dataclass(frozen=True)
class FaqEntry:
    id: str
    question: str
    answer: str
    keywords: str = ""  # extra search words (e.g. "broken" for "damaged")


# Words added to the search query for each intent, so a refund request finds
# the refund entries even if the summary uses different words.
INTENT_HINTS: dict[str, str] = {
    "order_status": "order status track tracking",
    "delivery_issue": "late delayed not arrived delivery",
    "refund_request": "refund money back damaged",
    "return_exchange": "return exchange size",
    "product_question": "available stock size",
    "payment_issue": "payment deducted charged",
    "complaint": "",
    "other": "",
}


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS]


class FaqIndex:
    def __init__(self, entries: list[FaqEntry]):
        self.entries = entries
        self._bm25 = BM25Okapi(
            [_tokens(f"{e.question} {e.answer} {e.keywords}") for e in entries]
        )

    def search(self, query: str, k: int = 3, intent: str | None = None) -> list[FaqEntry]:
        q = _tokens(f"{query} {INTENT_HINTS.get(intent or '', '')}")
        if not q:
            return []
        scores = self._bm25.get_scores(q)
        ranked = sorted(zip(scores, self.entries), key=lambda p: p[0], reverse=True)
        return [e for score, e in ranked[:k] if score > 0]


@lru_cache(maxsize=1)
def get_faq_index() -> FaqIndex:
    raw = json.loads(FAQ_PATH.read_text(encoding="utf-8"))
    return FaqIndex([FaqEntry(**item) for item in raw])
