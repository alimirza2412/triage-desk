import TicketList from "@/components/TicketList";

export default function ReviewPage() {
  return (
    <TicketList
      title="Review queue"
      subtitle="Tickets a human must check: low AI confidence, refunds, or upset and urgent customers."
      fixedStatus="needs_review"
    />
  );
}
