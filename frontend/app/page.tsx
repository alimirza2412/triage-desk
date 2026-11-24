"use client";

import { useCallback, useEffect, useState } from "react";

import NewMessageDialog from "@/components/NewMessageDialog";
import TicketRail from "@/components/TicketRail";
import TicketView from "@/components/TicketView";
import Welcome from "@/components/Welcome";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";

export default function Workspace() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await api.listTickets());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tickets.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  // keep the list in step when a ticket changes in the detail view
  const onChanged = useCallback((t: Ticket) => {
    setTickets((prev) => prev?.map((x) => (x.id === t.id ? { ...x, ...t } : x)) ?? prev);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-2.5 lg:h-[calc(100vh-4.5rem)] lg:grid-cols-[290px_minmax(0,1fr)_320px]">
      <TicketRail
        tickets={tickets}
        filter={filter}
        setFilter={setFilter}
        selectedId={selected}
        onSelect={setSelected}
        onNew={() => setComposing(true)}
        error={error}
      />
      {selected === null ? (
        <Welcome
          tickets={tickets ?? []}
          onFilter={setFilter}
          onNew={() => setComposing(true)}
        />
      ) : (
        <TicketView key={selected} id={selected} onChanged={onChanged} />
      )}
      {composing && (
        <NewMessageDialog
          onClose={() => setComposing(false)}
          onCreated={(t) => {
            setComposing(false);
            setTickets((prev) => [t, ...(prev ?? [])]);
            setFilter("");
            setSelected(t.id);
          }}
        />
      )}
    </div>
  );
}
