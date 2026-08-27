import { useCallback } from "react";

import apiClient, { isNotImplemented } from "../../api/client";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import EmptyState from "../../components/common/EmptyState";
import Table from "../../components/common/Table";
import { useChama } from "../../context/ChamaContext";
import useApiResource from "../../hooks/useApiResource";

const formatDate = (value) => (value ? String(value).replace("T", " ").slice(0, 19) : "—");

/**
 * /audit — read-only audit trail for officials.
 * The backend audit endpoint may not be deployed yet; a 404 is shown as an
 * informative empty state rather than an error.
 */
export function AuditPage() {
  const { chamaId } = useChama();

  const fetcher = useCallback(async () => {
    if (!chamaId) return [];
    try {
      return (await apiClient.get(`/chamas/${chamaId}/audit-trail`)).data;
    } catch (error) {
      if (isNotImplemented(error)) return null; // not deployed yet
      throw error;
    }
  }, [chamaId]);

  const { data, loading, error, refetch } = useApiResource(fetcher, {
    enabled: Boolean(chamaId),
  });

  const rows = Array.isArray(data) ? data : data?.events || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit trail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who did what, and when — read-only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader title="Recent events" description="Administrative actions in this chama." />
        {error ? (
          <CardBody>
            <EmptyState
              title="We couldn't load the audit trail"
              description={error}
              action={
                <Button variant="outline" onClick={refetch}>
                  Try again
                </Button>
              }
            />
          </CardBody>
        ) : data === null ? (
          <CardBody>
            <EmptyState
              title="Audit API not available yet"
              description="The audit-trail endpoint is not deployed on the backend yet. Ask your backend team to expose GET /chamas/{id}/audit-trail."
            />
          </CardBody>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <Table
              columns={[
                { key: "created_at", header: "When", className: "whitespace-nowrap", render: (r) => formatDate(r.created_at || r.timestamp) },
                { key: "actor", header: "Actor", render: (r) => r.actor_name || r.actor_id || "—" },
                { key: "action", header: "Action", render: (r) => r.action || r.event_type },
                { key: "details", header: "Details", render: (r) => r.details || r.description || "—" },
              ]}
              rows={rows}
              loading={loading}
              caption="Audit events"
              emptyTitle="No audit events yet"
              emptyDescription="Administrative actions will be recorded here."
            />
          </div>
        )}
      </Card>
    </div>
  );
}

export default AuditPage;
