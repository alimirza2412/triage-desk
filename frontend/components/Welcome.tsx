"use client";

import Link from "next/link";

import { ArrowUp, ArrowUpRight } from "@/components/Icons";
import type { Ticket } from "@/lib/types";

export default function Welcome({
  tickets,
  onFilter,
  onNew,
}: {
  tickets: Ticket[];
  onFilter: (f: string) => void;
  onNew: () => void;
}) {
  const review = tickets.filter((t) => t.status === "needs_review").length;
  const info = tickets.filter((t) => t.status === "needs_info").length;
  const urgent = tickets.filter((t) => t.priority === "high" && t.status !== "closed").length;
  const replies = tickets.filter((t) => t.reply_status === "draft").length;

  const tiles: { title: string; value: number | string; onClick?: () => void; href?: string; dark?: boolean }[] = [
    { title: "Waiting for review", value: review, onClick: () => onFilter("needs_review") },
    { title: "Missing order number", value: info, onClick: () => onFilter("needs_info") },
    { title: "Urgent and upset", value: urgent, onClick: () => onFilter("") },
    { title: "Replies drafted, see analytics", value: replies, href: "/analytics", dark: true },
  ];

  return (
    <section className="rise flex min-h-[70vh] min-w-0 flex-col gap-2.5 rounded-[28px] bg-paper p-4 sm:p-6 lg:col-span-2 lg:min-h-0">
      <div className="rounded-[28px] bg-lime p-6 sm:p-8">
        <div className="mb-10 text-sm font-semibold text-ink/60">Triage Desk · English · Urdu · Roman Urdu</div>
        <h1 className="text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          Hi team!
          <br />
          {review} {review === 1 ? "ticket needs" : "tickets need"} you.
        </h1>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2.5">
        {tiles.map((tile) => {
          const cls = `flex min-h-32 flex-col justify-between rounded-[26px] p-5 text-left transition hover:-translate-y-0.5 ${
            tile.dark ? "bg-sage-deep text-white" : "bg-white"
          }`;
          const inner = (
            <>
              <span
                className={`grid h-9 w-9 place-items-center rounded-full ${tile.dark ? "bg-white/20" : "bg-mist"}`}
              >
                <ArrowUpRight />
              </span>
              <span>
                <span className="block text-5xl font-semibold tracking-tight tabular-nums">{tile.value}</span>
                <span className={`text-sm ${tile.dark ? "text-white/80" : "text-ink/60"}`}>{tile.title}</span>
              </span>
            </>
          );
          return tile.href ? (
            <Link key={tile.title} href={tile.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={tile.title} onClick={tile.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-3 rounded-full bg-white p-1.5 pl-6 text-left shadow-sm"
      >
        <span className="flex-1 text-sm text-ink/50">Simulate a customer message…</span>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-lime">
          <ArrowUp />
        </span>
      </button>
    </section>
  );
}
