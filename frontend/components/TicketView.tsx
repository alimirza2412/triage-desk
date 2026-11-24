"use client";

import { useCallback, useEffect, useState } from "react";

import { ArrowUp, Check, Refresh, Sparkle } from "@/components/Icons";
import { api } from "@/lib/api";
import {
  EVENT_TEXT,
  FLAG_TEXT,
  LANG_TEXT,
  STATUS_TEXT,
  actorName,
  isUrdu,
  label,
  loadReviewer,
  saveReviewer,
  timeAgo,
} from "@/lib/format";
import { INTENTS, type Ticket, type TicketDetail } from "@/lib/types";

type Action = "approve" | "reroute" | "close";

export default function TicketView({ id, onChanged }: { id: number; onChanged: (t: Ticket) => void }) {
  const [t, setT] = useState<TicketDetail | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [draft, setDraft] = useState("");
  const [action, setAction] = useState<Action>("approve");
  const [newTeam, setNewTeam] = useState("");
  const [newIntent, setNewIntent] = useState("");

  const apply = useCallback(
    (d: TicketDetail) => {
      setT(d);
      setDraft(d.final_reply ?? d.suggested_reply ?? "");
      onChanged(d);
    },
    [onChanged],
  );

  useEffect(() => {
    setT(null);
    setError("");
    setAction("approve");
    setNewTeam("");
    setNewIntent("");
    setReviewer(loadReviewer());
    api.getTicket(id).then(apply).catch((e) => setError(e.message));
  }, [id, apply]);

  useEffect(() => {
    api.teams().then(setTeams).catch(() => setTeams([]));
  }, []);

  async function run(name: string, fn: () => Promise<TicketDetail>, needsName = true) {
    if (needsName && !reviewer.trim()) {
      setError("Add your name in the Review card first.");
      return;
    }
    setBusy(name);
    setError("");
    try {
      apply(await fn());
      if (reviewer.trim()) saveReviewer(reviewer.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  if (!t) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-[28px] bg-paper text-sm text-ink/50 lg:col-span-2">
        {error || "Opening ticket…"}
      </div>
    );
  }

  const conf = t.confidence === null ? null : Math.round(t.confidence * 100);
  const edited = t.suggested_reply !== null && draft.trim() !== t.suggested_reply;
  const closed = t.status === "closed";
  const sources = t.reply_sources;

  function confirmReview() {
    if (action === "reroute" && !newIntent && !newTeam) {
      setError("Pick a new intent or team to reroute.");
      return;
    }
    run(action, () =>
      api.review(id, {
        action,
        reviewer: reviewer.trim(),
        intent: action === "reroute" ? newIntent || undefined : undefined,
        team: action === "reroute" ? newTeam || undefined : undefined,
      }),
    );
  }

  return (
    <>
      {/* conversation */}
      <section className="rise flex min-h-[70vh] min-w-0 flex-col rounded-[28px] bg-paper p-5 sm:p-6 lg:min-h-0">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-tight">
              {t.intent ? label(t.intent) : "Needs a human"}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-ink/60">
              <span
                className={`h-2 w-2 rounded-full ${
                  t.status === "routed" ? "bg-lime-deep" : closed ? "bg-ink/30" : "bg-amber-500"
                }`}
              />
              {STATUS_TEXT[t.status]} · #{t.id} · {label(t.channel)}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-semibold">
            {t.team}
          </span>
        </header>

        <div className="scroll-thin -mr-2 flex-1 space-y-4 overflow-y-auto pr-2">
          {/* customer message */}
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <div className="mb-1 ml-3 text-xs font-medium text-ink/50">
                {t.customer_name ?? "Customer"} · {timeAgo(t.created_at)}
              </div>
              <div
                className={`rounded-[22px] rounded-tl-md bg-white px-5 py-3.5 text-[15px] shadow-sm ${
                  isUrdu(t.message) ? "urdu text-right" : ""
                }`}
              >
                {t.message}
              </div>
            </div>
          </div>

          {/* AI understanding */}
          <div className="rounded-[24px] bg-ink p-5 text-white">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-lime">
              <Sparkle className="h-3.5 w-3.5" /> What the AI understood
            </div>
            {t.intent ? (
              <>
                <p className="mb-4 text-[15px] leading-relaxed text-white/90">{t.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-ink">
                    {label(t.intent)}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">Urgency {t.urgency}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">{label(t.sentiment)} mood</span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">
                    {t.order_id ? `Order ${t.order_id}` : "No order number"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/70">
                The AI could not read this one, so it was saved and sent straight to a person.
              </p>
            )}
            {t.flags.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-xs text-white/50">Why it was flagged</div>
                {t.flags.map((f) => (
                  <div
                    key={f}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-lime/50 bg-white/5 px-4 py-2.5 text-sm"
                  >
                    {FLAG_TEXT[f] ?? label(f)}
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime text-ink">
                      <Check className="h-3 w-3" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* approved reply */}
          {t.reply_status === "approved" && t.final_reply && (
            <div className="flex justify-end">
              <div className="max-w-[85%]">
                <div
                  dir="auto"
                  className={`rounded-[22px] rounded-tr-md bg-lime px-5 py-3.5 text-[15px] ${
                    isUrdu(t.final_reply) ? "urdu text-right" : ""
                  }`}
                >
                  {t.final_reply}
                </div>
                <div className="mr-3 mt-1 text-right text-xs font-medium text-ink/50">Approved reply</div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

        {/* reply composer */}
        <div className="mt-4">
          {t.reply_status === "none" && (
            <div className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-sm">
              <span className="flex-1 text-sm text-ink/50">Let the AI draft a reply from the store FAQ</span>
              <button
                onClick={() => run("suggest", () => api.suggestReply(id), false)}
                disabled={busy !== ""}
                className="flex items-center gap-2 rounded-full bg-ink py-2.5 pl-4 pr-2.5 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-50"
              >
                {busy === "suggest" ? "Drafting…" : "Draft reply"}
                <span className="grid h-7 w-7 place-items-center rounded-full bg-lime text-ink">
                  <Sparkle className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>
          )}

          {t.reply_status === "draft" && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-ink/50">From FAQ:</span>
                {sources.map((s) => (
                  <span key={s.id} title={s.answer} className="rounded-full bg-lime px-3 py-1 text-xs font-semibold">
                    {s.question}
                  </span>
                ))}
                {sources.length === 0 && <span className="text-xs text-ink/50">no matching entry</span>}
                {t.reply_covered === false && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    FAQ does not fully cover this, check it
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2 rounded-[26px] bg-white p-2 pl-5 shadow-sm">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  dir="auto"
                  className={`scroll-thin flex-1 resize-none bg-transparent py-2 text-[15px] outline-none ${
                    isUrdu(draft) ? "urdu" : ""
                  }`}
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => run("suggest", () => api.suggestReply(id), false)}
                    disabled={busy !== ""}
                    title="Draft again"
                    className="grid h-11 w-11 place-items-center rounded-full bg-mist hover:bg-sage disabled:opacity-50"
                  >
                    <Refresh />
                  </button>
                  <button
                    onClick={() =>
                      run("approve-reply", () =>
                        api.approveReply(id, { reviewer: reviewer.trim(), final_text: edited ? draft.trim() : undefined }),
                      )
                    }
                    disabled={busy !== "" || !draft.trim()}
                    title={edited ? "Approve edited reply" : "Approve reply"}
                    className="grid h-11 w-11 place-items-center rounded-full bg-ink text-lime hover:bg-ink/85 disabled:opacity-50"
                  >
                    <ArrowUp />
                  </button>
                </div>
              </div>
              <div className="pl-5 text-xs text-ink/50">
                {busy === "approve-reply"
                  ? "Saving…"
                  : edited
                    ? "You edited the draft. The arrow approves your version."
                    : "Edit if needed, then press the arrow to approve."}
              </div>
            </div>
          )}

          {t.reply_status === "approved" && (
            <div className="flex items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-medium text-ink/60">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-lime text-ink">
                <Check className="h-3 w-3" />
              </span>
              Reply approved and ready to send
            </div>
          )}
        </div>
      </section>

      {/* right column */}
      <aside className="rise scroll-thin flex min-h-0 min-w-0 flex-col gap-2.5 lg:overflow-y-auto">
        <div className="rounded-[28px] bg-ink p-5 text-white">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-xl font-semibold leading-tight">
              Routing
              <br />
              decision
            </h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{STATUS_TEXT[t.status]}</span>
          </div>
          <dl className="space-y-2 text-xs">
            {[
              ["Team", t.team],
              ["Intent", label(t.intent)],
              ["Language", t.language ? LANG_TEXT[t.language] : "—"],
              ["Order", t.order_id ?? "Not given"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-white/50">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-white/50">AI confidence</span>
            <span className={`text-4xl font-semibold tabular-nums ${conf !== null && conf < 70 ? "text-amber-300" : "text-lime"}`}>
              {conf === null ? "—" : `${conf}%`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2.5 rounded-full bg-paper p-1.5 pr-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                t.priority === "high" ? "bg-ink text-lime" : "bg-mist text-ink"
              }`}
            >
              {t.priority === "high" ? "!" : "–"}
            </span>
            <span className="text-xs leading-tight">
              <span className="block font-semibold">{t.priority === "high" ? "High" : "Normal"}</span>
              <span className="text-ink/50">priority</span>
            </span>
          </div>
          <div className="rounded-[22px] bg-sage-deep px-4 py-2.5 text-white">
            <div className="text-[10px] text-white/70">Mood</div>
            <div className="text-lg font-semibold leading-tight">{label(t.sentiment)}</div>
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Review</h2>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Your name"
            className="mb-3 w-full rounded-full bg-mist px-4 py-2.5 text-sm outline-none placeholder:text-ink/40"
          />
          {closed ? (
            <p className="rounded-2xl bg-mist px-4 py-3 text-sm text-ink/60">This ticket is closed.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {(
                  [
                    ["approve", "Approve this routing"],
                    ["reroute", "Reroute to another team"],
                    ["close", "Close the ticket"],
                  ] as [Action, string][]
                ).map(([value, text]) => {
                  const on = action === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setAction(value)}
                      className={`flex w-full items-center justify-between rounded-full py-2 pl-4 pr-2 text-left text-sm font-medium transition ${
                        on ? "bg-ink text-white" : "bg-mist hover:bg-[#e4e7e0]"
                      }`}
                    >
                      {text}
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full ${on ? "bg-lime text-ink" : "bg-white"}`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {action === "reroute" && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <select
                    value={newIntent}
                    onChange={(e) => setNewIntent(e.target.value)}
                    className="rounded-full bg-mist px-3 py-2 text-xs outline-none"
                  >
                    <option value="">Same intent</option>
                    {INTENTS.map((i) => (
                      <option key={i} value={i}>
                        {label(i)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="rounded-full bg-mist px-3 py-2 text-xs outline-none"
                  >
                    <option value="">Team from intent</option>
                    {teams.map((tm) => (
                      <option key={tm}>{tm}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={confirmReview}
                disabled={busy !== ""}
                className="mt-4 flex w-full items-center justify-between rounded-full bg-lime py-1.5 pl-5 pr-1.5 text-sm font-semibold hover:bg-lime-deep disabled:opacity-50"
              >
                {busy && busy !== "suggest" && busy !== "approve-reply" ? "Saving…" : "Confirm"}
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-lime">
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            </>
          )}
        </div>

        <div className="rounded-[28px] bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Audit trail</h2>
          <ol className="space-y-3">
            {t.events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex flex-col items-center">
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      e.actor.startsWith("human") ? "bg-ink" : e.actor.startsWith("ai") ? "bg-lime-deep" : "bg-sage"
                    }`}
                  />
                  {i < t.events.length - 1 && <span className="mt-1 w-px flex-1 bg-mist" />}
                </span>
                <span className="pb-1 text-sm">
                  <span className="block font-medium">{EVENT_TEXT[e.event] ?? label(e.event)}</span>
                  <span className="text-xs text-ink/50">
                    {actorName(e.actor)} · {timeAgo(e.created_at)}
                    {e.details.edited === true && " · edited"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </>
  );
}
