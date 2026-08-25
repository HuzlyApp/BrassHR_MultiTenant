import { Suspense } from "react";
import SupportTicketsClient from "@/app/admin_recruiter/tickets/support/SupportTicketsClient";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";

export default function TicketsSupportPage() {
  return (
    <Suspense fallback={<DashboardPageLoader label="Loading support tickets..." className="min-h-[480px]" />}>
      <SupportTicketsClient />
    </Suspense>
  );
}
