"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";

const EXAMPLES = [
  "Mera order 4521 kab tak deliver hoga?",
  "Payment cut ho gayi lekin order confirm nahi hua",
  "میرا آرڈر 3344 ابھی تک نہیں پہنچا، براہ کرم چیک کریں",
  "Can I exchange my shoes for a bigger size? Order 6650",
];

export default function NewMessageForm({ onCreated }: { onCreated: (t: Ticket) => void }) {
  const [open, setOpen] = useState(false);
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
      const t = await api.createEnquiry({
        message,
        customer_name: name || undefined,
        channel: "web",
      });
      setMessage("");
      setName("");
      setOpen(false);
      onCreated(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
      >
        + Simulate customer message
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">New customer message</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Customer name (optional)"
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Type a message in English, Urdu or Roman Urdu"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex}
            onClick={() => setMessage(ex)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {ex.length > 38 ? `${ex.slice(0, 38)}…` : ex}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <button
        disabled={busy || !message.trim()}
        className="mt-3 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? "Classifying…" : "Send to Triage Desk"}
      </button>
    </form>
  );
}
