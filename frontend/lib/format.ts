export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function timeAgo(iso: string): string {
  const then = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function isUrdu(text: string): boolean {
  const letters = Array.from(text).filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return false;
  const arabic = letters.filter((c) => c >= "؀" && c <= "ۿ").length;
  return arabic / letters.length > 0.5;
}

export const FLAG_TEXT: Record<string, string> = {
  low_confidence: "The AI was not confident about this message.",
  refund_needs_approval: "Refunds always need a human to approve.",
  angry_and_urgent: "Upset and urgent customer: high priority.",
  missing_order_id: "Order question without an order number.",
  ai_unavailable: "The AI could not classify this message.",
};

const REVIEWER_KEY = "triage-desk-reviewer";

export function loadReviewer(): string {
  try {
    return localStorage.getItem(REVIEWER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveReviewer(name: string): void {
  try {
    localStorage.setItem(REVIEWER_KEY, name);
  } catch {
    /* storage may be unavailable; the name just will not be remembered */
  }
}

export const LANG_TEXT: Record<string, string> = {
  english: "English",
  urdu: "Urdu",
  roman_urdu: "Roman Urdu",
  mixed: "Mixed",
  other: "Other",
  unknown: "Not classified",
};

export const STATUS_TEXT: Record<string, string> = {
  routed: "Routed",
  needs_review: "Needs review",
  needs_info: "Needs info",
  closed: "Closed",
};

export const EVENT_TEXT: Record<string, string> = {
  received: "Message received",
  classified: "AI classified it",
  routed: "Rules routed it",
  flagged_for_review: "Sent for human review",
  needs_info: "Asked for more info",
  ai_failed: "AI could not classify",
  review_approve: "Routing approved",
  review_reroute: "Ticket rerouted",
  review_close: "Ticket closed",
  reply_drafted: "AI drafted a reply",
  reply_approved: "Reply approved",
};

export function actorName(actor: string): string {
  if (actor.startsWith("human:")) return actor.slice(6);
  if (actor.startsWith("ai:")) return "AI";
  return label(actor);
}
