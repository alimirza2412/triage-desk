import { label } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  routed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  needs_review: "bg-amber-50 text-amber-800 ring-amber-200",
  needs_info: "bg-sky-50 text-sky-700 ring-sky-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLE[status] ?? STATUS_STYLE.closed
      }`}
    >
      {label(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority !== "high") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      High
    </span>
  );
}

const LANG_TEXT: Record<string, string> = {
  english: "English",
  urdu: "Urdu",
  roman_urdu: "Roman Urdu",
  mixed: "Mixed",
  other: "Other",
};

export function LanguageBadge({ language }: { language: string | null }) {
  if (!language) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
      {LANG_TEXT[language] ?? label(language)}
    </span>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
      {children}
    </span>
  );
}
