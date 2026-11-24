"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LanguageBadge, Pill, PriorityBadge, StatusBadge } from "@/components/Badges";
import NewMessageForm from "@/components/NewMessageForm";
import { api } from "@/lib/api";
import { isUrdu, label, timeAgo } from "@/lib/format";
import type { Ticket } from "@/lib/types";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "needs_review", label: "Needs review" },
  { value: "needs_info", label: "Needs info" },
  { value: "routed", label: "Routed" },
  { value: "closed", label: "Closed" },
];

export default function TicketList({
  title,
  subtitle,
  fixedStatus,
  showComposer = false,
}: {
  title: string;
  subtitle: string;
  fixedStatus?: string;
  showComposer?: boolean;
}) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [status, setStatus] = useState(fixedStatus ?? "");
  const [team, setTeam] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.listTickets({ status, team });
      setTickets(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets.");
    }
  }, [status, team]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000); // keep the inbox fresh
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    api.teams().then(setTeams).catch(() => setTeams([]));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {showComposer && (
          <NewMessageForm onCreated={(t) => setTickets((prev) => [t, ...(prev ?? [])])} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!fixedStatus && (
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatus(t.value)}
                className={`rounded-md px-3 py-1.5 ${
                  status === t.value
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">Refreshes every 10 seconds</span>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {tickets === null && !error && <p className="text-sm text-slate-500">Loading tickets…</p>}

      {tickets && tickets.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No tickets here yet.
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tickets/${t.id}`}
                className={`flex gap-4 px-4 py-3 hover:bg-slate-50 ${
                  t.priority === "high" ? "border-l-4 border-l-rose-400" : "border-l-4 border-l-transparent"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">#{t.id}</span>
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <Pill>{t.team}</Pill>
                    <LanguageBadge language={t.language} />
                    {t.reply_status === "approved" && (
                      <span className="text-xs text-emerald-700">Reply approved</span>
                    )}
                  </div>
                  <p
                    className={`truncate text-sm text-slate-900 ${isUrdu(t.message) ? "urdu text-right" : ""}`}
                  >
                    {t.message}
                  </p>
                  {t.summary && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {label(t.intent)} · {t.summary}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">
                  <div>{timeAgo(t.created_at)}</div>
                  {t.customer_name && <div className="mt-1 text-slate-500">{t.customer_name}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
