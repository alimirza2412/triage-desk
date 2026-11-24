"""Send sample customer messages to a running Triage Desk and print the result.

Usage (with the API running on port 8000):
    python scripts/try_messages.py
    python scripts/try_messages.py --base-url https://your-api.onrender.com
    python scripts/try_messages.py --replies     # also draft a reply for each
"""
from __future__ import annotations

import argparse
import time

import httpx

SAMPLES = [
    "Hi, is the black hoodie available in large size?",
    "Mera order 4521 kab tak deliver hoga?",
    "Where is my order? I placed it last week.",
    "Mujhe refund chahiye, product toot ke aaya hai. Order 7781.",
    "3 hafte ho gaye order nahi aaya, bohat bura service hai! Order 9012",
    "میرا آرڈر 3344 ابھی تک نہیں پہنچا، براہ کرم چیک کریں",
    "Payment cut ho gayi lekin order confirm nahi hua",
    "Can I exchange my shoes for a bigger size? Order 6650",
    "Your packaging was really nice, thanks!",
    "asdfgh",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--replies", action="store_true",
                    help="also ask the AI to draft a reply for each ticket")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    with httpx.Client(timeout=60) as client:
        for msg in SAMPLES:
            r = client.post(f"{base}/api/enquiries", json={"message": msg})
            if r.status_code != 201:
                print(f"ERROR {r.status_code}: {r.text[:200]}")
                continue
            t = r.json()
            conf = f"{t['confidence']:.2f}" if t["confidence"] is not None else "-"
            print(f"#{t['id']:<3} {t['status']:<13} {t['priority']:<7} {t['team']:<18} "
                  f"{t['intent'] or '-':<17} {t['language'] or '-':<11} conf={conf} "
                  f"flags={t['flags']}")
            print(f"     \"{msg[:70]}\"")
            time.sleep(1.5)  # stay under Groq's free-tier rate limit
            if args.replies:
                d = client.post(f"{base}/api/tickets/{t['id']}/suggest-reply")
                if d.status_code == 200:
                    dj = d.json()
                    used = [s["id"] for s in dj["reply_sources"]]
                    print(f"     reply (covered={dj['reply_covered']}, faq={used}):")
                    print(f"       {dj['suggested_reply']}")
                else:
                    print(f"     reply ERROR {d.status_code}")
                time.sleep(1.5)


if __name__ == "__main__":
    main()
