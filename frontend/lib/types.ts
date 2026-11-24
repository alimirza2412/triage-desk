export type Status = "routed" | "needs_review" | "needs_info" | "closed";

export interface Ticket {
  id: number;
  created_at: string;
  channel: string;
  customer_name: string | null;
  customer_contact: string | null;
  message: string;
  intent: string | null;
  urgency: string | null;
  sentiment: string | null;
  language: string | null;
  confidence: number | null;
  order_id: string | null;
  summary: string | null;
  team: string;
  status: Status;
  priority: "normal" | "high";
  flags: string[];
  reply_status: "none" | "draft" | "approved";
}

export interface AuditEvent {
  created_at: string;
  event: string;
  actor: string;
  details: Record<string, unknown>;
}

export interface ReplySource {
  id: string;
  question: string;
  answer: string;
}

export interface TicketDetail extends Ticket {
  events: AuditEvent[];
  suggested_reply: string | null;
  reply_sources: ReplySource[];
  reply_covered: boolean | null;
  final_reply: string | null;
}

export interface Stats {
  total: number;
  by_status: Record<string, number>;
  by_intent: Record<string, number>;
  by_language: Record<string, number>;
  by_team: Record<string, number>;
  by_priority: Record<string, number>;
}

export const INTENTS = [
  "order_status",
  "delivery_issue",
  "refund_request",
  "return_exchange",
  "product_question",
  "payment_issue",
  "complaint",
  "other",
] as const;
