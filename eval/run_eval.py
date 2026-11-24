"""Triage Desk eval: 60 labelled messages (20 English, 20 Roman Urdu, 20 Urdu).

Sends every message through the running API (the full pipeline: AI
classification plus routing rules) and reports, overall and per language:
  - intent accuracy   : the AI picked the labelled intent
  - team accuracy     : the ticket landed with the right team
  - language accuracy : the AI detected the language correctly

Usage (API running on port 8000):
    python eval/run_eval.py
    python eval/run_eval.py --base-url https://your-api.onrender.com

Writes eval/results.csv and prints a Markdown table for the README.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.rules import TEAM_BY_INTENT  # noqa: E402

HERE = Path(__file__).resolve().parent
LANGS = ["english", "roman_urdu", "urdu"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--pause", type=float, default=1.5,
                    help="seconds between messages (Groq free-tier rate limit)")
    ap.add_argument("--out", default=str(HERE / "results.csv"))
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    cases = [json.loads(line) for line in (HERE / "messages.jsonl").read_text(
        encoding="utf-8").splitlines() if line.strip()]

    rows = []
    with httpx.Client(timeout=120) as client:
        for c in cases:
            r = client.post(f"{base}/api/enquiries",
                            json={"message": c["message"], "channel": "api"})
            if r.status_code != 201:
                print(f"{c['id']:>2}. HTTP {r.status_code}  {c['message'][:50]}")
                rows.append({**c, "got_intent": "", "got_team": "", "got_language": "",
                             "error": f"HTTP {r.status_code}"})
                continue
            t = r.json()
            error = "ai_unavailable" if "ai_unavailable" in t["flags"] else ""
            row = {**c, "got_intent": t["intent"] or "", "got_team": t["team"],
                   "got_language": t["language"] or "", "error": error}
            rows.append(row)
            ok = "OK" if row["got_intent"] == c["intent"] else "XX"
            print(f"{c['id']:>2}. {ok}  {c['language']:<10} want={c['intent']:<16} "
                  f"got={row['got_intent'] or error:<16} {c['message'][:40]}")
            time.sleep(args.pause)

    for r in rows:
        r["intent_ok"] = r["got_intent"] == r["intent"]
        r["team_ok"] = r["got_team"] == TEAM_BY_INTENT[r["intent"]] and not r["error"]
        r["language_ok"] = r["got_language"] == r["language"]

    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        fields = ["id", "language", "intent", "message", "got_intent", "got_team",
                  "got_language", "intent_ok", "team_ok", "language_ok", "error"]
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows({k: r[k] for k in fields} for r in rows)

    def score(subset, key):
        n = len(subset)
        k = sum(r[key] for r in subset)
        return f"{k}/{n} ({k / n:.0%})" if n else "-"

    by_lang = defaultdict(list)
    for r in rows:
        by_lang[r["language"]].append(r)

    print("\n| Language | Intent | Team | Language detected |")
    print("| --- | --- | --- | --- |")
    for lang in LANGS:
        s = by_lang[lang]
        print(f"| {lang} | {score(s, 'intent_ok')} | {score(s, 'team_ok')} | "
              f"{score(s, 'language_ok')} |")
    print(f"| **All** | **{score(rows, 'intent_ok')}** | **{score(rows, 'team_ok')}** | "
          f"**{score(rows, 'language_ok')}** |")

    misses = [r for r in rows if not r["intent_ok"]]
    if misses:
        print("\nMisses:")
        for r in misses:
            print(f"  #{r['id']} [{r['language']}] want {r['intent']}, got "
                  f"{r['got_intent'] or r['error']}: {r['message']}")

    errors = sum(1 for r in rows if r["error"])
    if errors:
        print(f"\nWARNING: {errors} message(s) had service errors. "
              "Re-run before quoting these numbers.")
    print(f"\nDetails saved to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
