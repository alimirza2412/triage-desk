"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ArrowLeft } from "@/components/Icons";
import { api } from "@/lib/api";
import { LANG_TEXT, STATUS_TEXT, label } from "@/lib/format";
import type { Stats } from "@/lib/types";

function Breakdown({ title, data, names }: { title: string; data: Record<string, number>; names?: Record<string, string> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className="rounded-[28px] bg-white p-6">
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-ink/40">No data yet.</p>}
      <ul className="space-y-3">
        {rows.map(([key, n], i) => (
          <li key={key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-ink/70">{names?.[key] ?? label(key)}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </div>
            <div className="h-2.5 rounded-full bg-mist">
              <div
                className={`h-2.5 rounded-full ${i === 0 ? "bg-lime-deep" : "bg-ink"}`}
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.stats().then(setStats).catch((e) => setError(e instanceof Error ? e.message : "Could not load stats."));
  }, []);

  const s = stats;
  const auto = s?.by_status.routed ?? 0;
  const pct = s && s.total ? Math.round((auto / s.total) * 100) : 0;

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="rounded-[28px] bg-lime p-6 sm:p-8">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-lime"
          >
            <ArrowLeft /> Inbox
          </Link>
          <div className="text-sm font-semibold text-ink/60">Total tickets</div>
          <div className="text-7xl font-semibold tracking-tight tabular-nums">{s?.total ?? "–"}</div>
        </div>
        <div className="flex flex-col justify-between rounded-[28px] bg-ink p-6 text-white">
          <div className="text-sm text-white/60">Handled without a human</div>
          <div className="text-6xl font-semibold text-lime tabular-nums">{s ? `${pct}%` : "–"}</div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-lime" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid gap-2.5">
          <div className="rounded-[28px] bg-paper p-6">
            <div className="text-sm text-ink/60">Waiting for review</div>
            <div className="text-4xl font-semibold tabular-nums">{s?.by_status.needs_review ?? "–"}</div>
          </div>
          <div className="rounded-[28px] bg-sage-deep p-6 text-white">
            <div className="text-sm text-white/80">High priority</div>
            <div className="text-4xl font-semibold tabular-nums">{s?.by_priority.high ?? "–"}</div>
          </div>
        </div>
      </div>
      {error && <p className="rounded-[20px] bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</p>}
      {s && (
        <div className="grid gap-2.5 md:grid-cols-2">
          <Breakdown title="What customers want" data={s.by_intent} />
          <Breakdown title="Language" data={s.by_language} names={LANG_TEXT} />
          <Breakdown title="Team" data={s.by_team} />
          <Breakdown title="Status" data={s.by_status} names={STATUS_TEXT} />
        </div>
      )}
    </div>
  );
}
