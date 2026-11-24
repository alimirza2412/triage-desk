"use client";

import { useState } from "react";

import { ArrowUp, X } from "@/components/Icons";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";

const EXAMPLES = [
  "Mera order 4521 kab tak deliver hoga?",
  "Payment cut ho gayi lekin order confirm nahi hua",
  "میرا آرڈر 3344 ابھی تک نہیں پہنچا، براہ کرم چیک کریں",
  "Can I exchange my shoes for a bigger size? Order 6650",
  "Third time asking! Parcel damaged, I want my money back NOW",
];

export default function NewMessageDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: Ticket) => void;
}) {
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      onCreated(await api.createEnquiry({ message, customer_name: name || undefined, channel: "web" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-lg rounded-[32px] bg-lime p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink/60">Simulate</div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              New customer
              <br />
              message
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 hover:bg-white"
          >
            <X />
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer name (optional)"
          className="mb-2.5 w-full rounded-full bg-white px-5 py-3 text-sm outline-none placeholder:text-ink/40"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          autoFocus
          dir="auto"
          placeholder="Type in English, Urdu or Roman Urdu…"
          className="w-full resize-none rounded-[24px] bg-white px-5 py-4 text-sm outline-none placeholder:text-ink/40"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              type="button"
              key={ex}
              onClick={() => setMessage(ex)}
              className="rounded-full bg-ink/10 px-3 py-1.5 text-xs font-medium hover:bg-ink hover:text-lime"
            >
              {ex.length > 30 ? `${ex.slice(0, 30)}…` : ex}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 rounded-2xl bg-white px-4 py-2 text-sm text-rose-700">{error}</p>}
        <button
          disabled={busy || !message.trim()}
          className="mt-5 flex w-full items-center justify-between rounded-full bg-ink py-2 pl-6 pr-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "AI is reading it…" : "Send to Triage Desk"}
          <span className="grid h-10 w-10 place-items-center rounded-full bg-lime text-ink">
            <ArrowUp />
          </span>
        </button>
      </form>
    </div>
  );
}
