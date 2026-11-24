"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { label } from "@/lib/format";
import type { Stats } from "@/lib/types";

const LANG_TEXT: Record<string, string> = {
  english: "English",
  urdu: "Urdu",
  roman_urdu: "Roman Urdu",
  mixed: "Mixed",
  other: "Other",
  unknown: "Not classified",
};

function Breakdown({
  title,
  data,
  names,
}: {
  title: string;
  data: Record<string, number>;
  names?: Record<string, string>;
}) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
      <ul className="space-y-2.5">
        {rows.map(([key, n]) => (
          <li key={key} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="truncate text-slate-600">{names?.[key] ?? label(key)}</span>
            <span className="h-2 rounded-full bg-slate-100">
              <span
                className="block h-2 rounded-full bg-indigo-500"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-slate-900">{n}</span>
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
    api
      .stats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load stats."));
  }, []);

  if (error)
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  if (!stats) return <p className="text-sm text-slate-500">Loading…</p>;

  const review = stats.by_status.needs_review ?? 0;
  const auto = stats.by_status.routed ?? 0;
  const high = stats.by_priority.high ?? 0;
  const cards = [
    { label: "Total tickets", value: stats.total },
    { label: "Routed automatically", value: auto },
    { label: "Waiting for review", value: review },
    { label: "High priority", value: high },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-slate-500">What customers are writing about, and in which language.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown title="By intent" data={stats.by_intent} />
        <Breakdown title="By language" data={stats.by_language} names={LANG_TEXT} />
        <Breakdown title="By team" data={stats.by_team} />
        <Breakdown title="By status" data={stats.by_status} />
      </div>
    </div>
  );
}
