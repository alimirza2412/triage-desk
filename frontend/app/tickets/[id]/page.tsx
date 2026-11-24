"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { LanguageBadge, Pill, PriorityBadge, StatusBadge } from "@/components/Badges";
import { api } from "@/lib/api";
import { FLAG_TEXT, isUrdu, label, loadReviewer, saveReviewer, timeAgo } from "@/lib/format";
import { INTENTS, type TicketDetail } from "@/lib/types";

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{name}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

const EVENT_TEXT: Record<string, string> = {
  received: "Message received",
  classified: "AI classified the message",
  routed: "Rules routed the ticket",
  flagged_for_review: "Rules sent it for human review",
  needs_info: "Rules asked for more information",
  ai_failed: "AI could not classify",
  review_approve: "Reviewer approved the routing",
  review_reroute: "Reviewer rerouted the ticket",
  review_close: "Reviewer closed the ticket",
  reply_drafted: "AI drafted a reply",
  reply_approved: "Reviewer approved the reply",
};

export default function TicketPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [draft, setDraft] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newIntent, setNewIntent] = useState("");

  const apply = useCallback((t: TicketDetail) => {
    setTicket(t);
    setDraft(t.final_reply ?? t.suggested_reply ?? "");
  }, []);

  useEffect(() => {
    setReviewer(loadReviewer());
    api.getTicket(id).then(apply).catch((e) => setError(e.message));
    api.teams().then(setTeams).catch(() => setTeams([]));
  }, [id, apply]);

  async function run(name: string, fn: () => Promise<TicketDetail>) {
    if (!reviewer.trim() && name !== "suggest") {
      setError("Enter your name as the reviewer first.");
      return;
    }
    setBusy(name);
    setError("");
    try {
      apply(await fn());
      saveReviewer(reviewer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  if (!ticket) {
    return error ? (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
    ) : (
      <p className="text-sm text-slate-500">Loading ticket…</p>
    );
  }

  const urdu = isUrdu(ticket.message);
  const conf = ticket.confidence;
  const replyEdited = ticket.suggested_reply !== null && draft !== ticket.suggested_reply;

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to inbox
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">Ticket #{ticket.id}</h1>
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <Pill>{ticket.team}</Pill>
        <LanguageBadge language={ticket.language} />
        <span className="text-xs text-slate-400">
          {label(ticket.channel)} · {timeAgo(ticket.created_at)}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card title={ticket.customer_name ? `Message from ${ticket.customer_name}` : "Customer message"}>
            <p className={`whitespace-pre-wrap text-base ${urdu ? "urdu text-right" : ""}`}>{ticket.message}</p>
          </Card>

          <Card title="What the AI understood">
            {ticket.intent ? (
              <>
                <p className="mb-4 text-sm text-slate-700">{ticket.summary}</p>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Field name="Intent">{label(ticket.intent)}</Field>
                  <Field name="Urgency">{label(ticket.urgency)}</Field>
                  <Field name="Sentiment">{label(ticket.sentiment)}</Field>
                  <Field name="Order number">{ticket.order_id ?? "Not given"}</Field>
                  <Field name="Language">{label(ticket.language)}</Field>
                  <Field name="Confidence">
                    {conf !== null && (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 rounded-full bg-slate-100">
                          <span
                            className={`block h-1.5 rounded-full ${conf < 0.7 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.round(conf * 100)}%` }}
                          />
                        </span>
                        {Math.round(conf * 100)}%
                      </span>
                    )}
                  </Field>
                </dl>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                The AI could not classify this message, so it was saved and sent to a human.
              </p>
            )}
            {ticket.flags.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                {ticket.flags.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-amber-800">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {FLAG_TEXT[f] ?? label(f)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Suggested reply"
            right={
              ticket.reply_status !== "none" && (
                <span
                  className={`text-xs font-medium ${
                    ticket.reply_status === "approved" ? "text-emerald-700" : "text-slate-500"
                  }`}
                >
                  {ticket.reply_status === "approved" ? "Approved" : "Draft"}
                </span>
              )
            }
          >
            {ticket.reply_status === "none" ? (
              <div className="text-sm text-slate-600">
                <p className="mb-3">
                  The AI drafts a reply in the customer&apos;s language using only the store FAQ. You check it before
                  it is sent.
                </p>
                <button
                  onClick={() => run("suggest", () => api.suggestReply(id))}
                  disabled={busy !== ""}
                  className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busy === "suggest" ? "Drafting…" : "Draft a reply"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ticket.reply_covered === false && ticket.reply_status === "draft" && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    The FAQ does not fully answer this message. Check the reply carefully.
                  </p>
                )}
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={ticket.reply_status === "approved"}
                  rows={5}
                  dir={isUrdu(draft) ? "rtl" : "ltr"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                />
                {ticket.reply_sources.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-slate-500">Based on these FAQ entries</div>
                    <ul className="space-y-1.5">
                      {ticket.reply_sources.map((s) => (
                        <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <span className="font-medium text-slate-800">{s.question}</span> {s.answer}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ticket.reply_status === "draft" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        run("approve-reply", () =>
                          api.approveReply(id, {
                            reviewer,
                            final_text: replyEdited ? draft : undefined,
                          }),
                        )
                      }
                      disabled={busy !== "" || !draft.trim()}
                      className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {busy === "approve-reply" ? "Saving…" : replyEdited ? "Approve edited reply" : "Approve reply"}
                    </button>
                    <button
                      onClick={() => run("suggest", () => api.suggestReply(id))}
                      disabled={busy !== ""}
                      className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busy === "suggest" ? "Drafting…" : "Draft again"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Review">
            <label className="mb-1 block text-xs text-slate-500">Your name</label>
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="e.g. Ali"
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            {ticket.status === "closed" ? (
              <p className="text-sm text-slate-500">This ticket is closed.</p>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => run("approve", () => api.review(id, { action: "approve", reviewer }))}
                  disabled={busy !== ""}
                  className="w-full rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Approve routing to {ticket.team}
                </button>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 text-xs font-medium text-slate-500">Or reroute</div>
                  <select
                    value={newIntent}
                    onChange={(e) => setNewIntent(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">Keep intent</option>
                    {INTENTS.map((i) => (
                      <option key={i} value={i}>
                        {label(i)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">Team from intent</option>
                    {teams.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      run("reroute", () =>
                        api.review(id, {
                          action: "reroute",
                          reviewer,
                          intent: newIntent || undefined,
                          team: newTeam || undefined,
                        }),
                      )
                    }
                    disabled={busy !== "" || (!newIntent && !newTeam)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Reroute
                  </button>
                </div>
                <button
                  onClick={() => run("close", () => api.review(id, { action: "close", reviewer }))}
                  disabled={busy !== ""}
                  className="w-full text-sm text-slate-500 hover:text-slate-800 disabled:opacity-50"
                >
                  Close ticket
                </button>
              </div>
            )}
          </Card>

          <Card title="Audit trail">
            <ol className="relative space-y-4 border-l border-slate-200 pl-4">
              {ticket.events.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500" />
                  <div className="text-sm text-slate-800">{EVENT_TEXT[e.event] ?? label(e.event)}</div>
                  <div className="text-xs text-slate-500">
                    {e.actor} · {timeAgo(e.created_at)}
                  </div>
                  {typeof e.details.prompt_version === "string" && (
                    <div className="text-xs text-slate-400">Prompt {e.details.prompt_version}</div>
                  )}
                  {typeof e.details.note === "string" && e.details.note && (
                    <div className="text-xs text-slate-500">“{e.details.note}”</div>
                  )}
                  {e.details.edited === true && <div className="text-xs text-slate-500">Edited before approval</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
