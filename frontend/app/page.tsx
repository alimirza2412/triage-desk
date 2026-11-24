import TicketList from "@/components/TicketList";

export default function InboxPage() {
  return (
    <TicketList
      title="Inbox"
      subtitle="Every customer message, classified by AI and routed by rules. Urgent ones first."
      showComposer
    />
  );
}
