import { Clock } from "lucide-react";

import Button from "../../components/common/Button";
import Card, { CardBody } from "../../components/common/Card";
import StatusBadge from "../../components/common/StatusBadge";
import Table from "../../components/common/Table";
import useAuth from "../../hooks/useAuth";

const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");

/**
 * Sub-state of "no membership": the user has requests awaiting approval.
 * Read-only — they simply wait for an official or the platform admin.
 */
export function PendingDashboard() {
  const { user, pendingJoinRequests, pendingChamaRequests, refresh } = useAuth();

  const rows = [
    ...pendingJoinRequests.map((r) => ({
      ...r,
      kind: "Join request",
      label: r.chama_name || r.chama_id,
      date: r.created_at,
      status: r.status || "PENDING",
    })),
    ...pendingChamaRequests.map((r) => ({
      ...r,
      kind: "Chama creation",
      label: r.name,
      date: r.created_at,
      status: r.status || "PENDING",
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Clock className="h-6 w-6 text-primary" aria-hidden="true" />
            Awaiting approval, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your request is being reviewed. You'll get access as soon as it's approved.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          Check status
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          <Table
            columns={[
              { key: "kind", header: "Request" },
              { key: "label", header: "Chama" },
              { key: "date", header: "Submitted", className: "whitespace-nowrap", render: (r) => formatDate(r.date) },
              { key: "status", header: "Status", render: (r) => <StatusBadge status={String(r.status).toLowerCase()}>{r.status}</StatusBadge> },
            ]}
            rows={rows}
            caption="Your pending requests"
            emptyTitle="No pending requests"
            emptyDescription="Submit a join or creation request from the onboarding options."
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default PendingDashboard;
