"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Inbox" },
  { href: "/review", label: "Review queue" },
  { href: "/analytics", label: "Analytics" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
            T
          </span>
          Triage Desk
        </Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 ${
                  active
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
