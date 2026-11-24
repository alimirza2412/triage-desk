"use client";

import Link from "next/link";

import { Chart, Plus } from "@/components/Icons";
import { LANG_TEXT, label, timeAgo } from "@/lib/format";
import type { Ticket } from "@/lib/types";

export const FILTERS = [
  { value: "", label: "All" },
  { value: "needs_review", label: "Review" },
  { value: "needs_info", label: "Info" },
  { value: "routed", label: "Routed" },
  { value: "closed", label: "Closed" },
];

export default function TicketRail({
  tickets,
  filter,
  setFilter,
  selectedId,
  onSelect,
  onNew,
  error,
}: {
  tickets: Ticket[] | null;
  filter: string;
  setFilter: (f: string) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
  error: string;
}) {
  const all = tickets ?? [];
  const open = all.filter((t) => t.status !== "closed");
  const auto = all.filter((t) => t.status === "routed").length;
  const pct = all.length ? Math.round((auto / all.length) * 100) : 0;
  const shown = filter ? all.filter((t) => t.status === filter) : all;
  const count = (s: string) => (s ? all.filter((t) => t.status === s).length : all.length);

  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-2.5">
      {/* brand card */}
      <div className="relative rounded-[28px] bg-lime p-5">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => onSelect(null)} className="flex items-center gap-2.5 text-left">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-lime">
              T
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">Triage AI</span>
              <span className="block text-xs text-ink/60">Support desk</span>
            </span>
          </button>
          <div className="flex gap-1.5">
            <Link
              href="/analytics"
              title="Analytics"
              className="grid h-10 w-10 place-items-center rounded-full bg-white hover:bg-ink hover:text-lime"
            >
              <Chart />
            </Link>
            <button
              onClick={onNew}
              title="Simulate a customer message"
              className="grid h-10 w-10 place-items-center rounded-full bg-white hover:bg-ink hover:text-lime"
            >
              <Plus />
            </button>
          </div>
        </div>
        <div className="text-3xl font-semibold tracking-tight">{open.length} open</div>
        <div className="mt-4 h-1.5 rounded-full bg-white/60">
          <div className="h-1.5 rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium text-ink/70">
          <span>Handled without a human</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* tickets */}
      <div className="flex min-h-[420px] flex-1 flex-col rounded-[28px] bg-white p-4 lg:min-h-0">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-xl font-semibold tracking-tight">Requests</h2>
          <button
            onClick={onNew}
            className="grid h-9 w-9 place-items-center rounded-full bg-ink text-white hover:bg-lime hover:text-ink"
          >
            <Plus />
          </button>
        </div>
        <div className="scroll-thin -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.value ? "bg-lime text-ink" : "bg-mist text-ink/60 hover:text-ink"
              }`}
            >
              {f.label}
              <span className="tabular-nums opacity-60">{count(f.value)}</span>
            </button>
          ))}
        </div>

        {error && <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {tickets === null && !error && <p className="px-1 text-sm text-ink/50">Loading…</p>}
        {tickets && shown.length === 0 && (
          <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-ink/50">Nothing here.</p>
        )}

        <ul className="scroll-thin -mr-2 flex-1 space-y-1.5 overflow-y-auto pr-2">
          {shown.map((t) => {
            const active = t.id === selectedId;
            return (
              <li key={t.id}>
                <button
                  onClick={() => onSelect(t.id)}
                  className={`w-full rounded-[18px] px-4 py-3 text-left transition ${
                    active ? "bg-ink text-white" : "bg-mist hover:bg-[#e4e7e0]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {t.intent ? label(t.intent) : "Unclassified"}
                    </span>
                    {t.priority === "high" ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          active ? "bg-lime text-ink" : "bg-ink text-lime"
                        }`}
                      >
                        Urgent
                      </span>
                    ) : (
                      t.status === "needs_review" && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-lime-deep" />
                      )
                    )}
                  </div>
                  <div className={`mt-0.5 flex gap-1.5 text-xs ${active ? "text-white/60" : "text-ink/50"}`}>
                    <span>#{t.id}</span>·<span>{t.language ? LANG_TEXT[t.language] : "?"}</span>·
                    <span>{timeAgo(t.created_at)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
