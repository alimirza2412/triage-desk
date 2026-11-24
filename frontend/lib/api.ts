import type { Stats, Ticket, TicketDetail } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the API. Is it running, or waking up?");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail[0]?.msg ?? detail;
    } catch {
      /* keep the default message */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTickets: (params: { status?: string; team?: string; priority?: string } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    q.set("limit", "200");
    return request<Ticket[]>(`/api/tickets?${q.toString()}`);
  },
  getTicket: (id: number) => request<TicketDetail>(`/api/tickets/${id}`),
  createEnquiry: (body: { message: string; customer_name?: string; channel?: string }) =>
    request<Ticket>("/api/enquiries", { method: "POST", body: JSON.stringify(body) }),
  review: (
    id: number,
    body: { action: "approve" | "reroute" | "close"; reviewer: string; team?: string; intent?: string; note?: string },
  ) => request<TicketDetail>(`/api/tickets/${id}/review`, { method: "POST", body: JSON.stringify(body) }),
  suggestReply: (id: number) =>
    request<TicketDetail>(`/api/tickets/${id}/suggest-reply`, { method: "POST" }),
  approveReply: (id: number, body: { reviewer: string; final_text?: string }) =>
    request<TicketDetail>(`/api/tickets/${id}/reply/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  stats: () => request<Stats>("/api/stats"),
  teams: () => request<string[]>("/api/teams"),
};
