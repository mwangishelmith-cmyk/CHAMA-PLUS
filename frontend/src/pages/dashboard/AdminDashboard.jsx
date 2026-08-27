import { ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import chamaApi from "../../api/chamas";
import { getErrorMessage } from "../../api/client";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/common/StatusBadge";
import Table from "../../components/common/Table";
import { useToast } from "../../context/ToastContext";
import useApiResource from "../../hooks/useApiResource";

const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");

/**
 * STATE A — platform administrator (`is_super_admin`).
 *
 * Deliberately shows no member financial data: only the chama creation
 * requests queue from `GET /chama-requests`, with approve/reject actions.
 */
export function AdminDashboard() {
  const toast = useToast();
  const fetcher = useCallback(() => chamaApi.creationRequests(), []);
  const { data, loading, error, refetch } = useApiResource(fetcher, { initialData: [] });

  // id of the request currently being processed -> disables its buttons.
  const [processingId, setProcessingId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { request, action }
  const [statuses, setStatuses] = useState({}); // local status after an action

  const act = async (request, action) => {
    setProcessingId(request.id);
    try {
      if (action === "approve") await chamaApi.approveCreationRequest(request.id);
      else await chamaApi.rejectCreationRequest(request.id);
      setStatuses((s) => ({ ...s, [request.id]: action === "approve" ? "APPROVED" : "REJECTED" }));
      toast.success(
        action === "approve"
          ? `"${request.name}" approved and created.`
          : `"${request.name}" rejected.`,
      );
      setConfirm(null);
      await refreshTables();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const rows = (data || []).map((r) => ({ ...r, status: statuses[r.id] || r.status }));

  const columns = [
    { key: "name", header: "Chama name" },
    {
      key: "creator",
      header: "Creator",
      render: (row) => row.requested_by_name || row.requested_by,
    },
    { key: "chama_type", header: "Chama type" },
    {
      key: "created_at",
      header: "Created on",
      className: "whitespace-nowrap",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge status={String(row.status || "pending").toLowerCase()}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "whitespace-nowrap",
      render: (row) => {
        const busy = processingId === row.id;
        const done = row.status && row.status !== "PENDING";
        if (done) return <span className="text-xs text-muted-foreground">No action needed</span>;
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={busy}
              disabled={Boolean(processingId)}
              onClick={() => setConfirm({ request: row, action: "approve" })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(processingId)}
              onClick={() => setConfirm({ request: row, action: "reject" })}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const auditFetcher = useCallback(
    () => chamaApi.adminAuditTrails(),
    [],
  );

  const {
    data: auditData,
    loading: auditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useApiResource(auditFetcher, {
    initialData: [],
  });

  const auditColumns = [
    {
      key: "created_at",
      header: "Date",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actor_id",
      header: "User",
      render: (row) => row.actor_id || "System",
    },
    {
      key: "action",
      header: "Action",
    },
    {
      key: "table_name",
      header: "Resource",
    },
    {
      key: "details",
      header: "Details",
      render: (row) => row.details || "—",
    },
  ];

  const refreshTables = async () => {
    await Promise.all([refetch(), refetchAudit()]);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            Platform administration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and process chama creation requests.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshTables}
          loading={loading || auditLoading}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <Card>
          <CardBody>
            <EmptyState
              title="We couldn't load the requests"
              description={error}
              action={
                <Button variant="outline" onClick={refetch}>
                  Try again
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Chama creation requests"
            description="Approving a request creates the chama and its first member profile."
          />
          <div className="max-h-[32rem] overflow-y-auto">
            <Table
              columns={columns}
              rows={rows}
              loading={loading}
              caption="Chama creation requests"
              emptyTitle="No pending requests"
              emptyDescription="New chama requests will appear here for review."
            />
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.action === "reject" ? "Reject this request?" : "Approve this request?"
        }
        description={
          confirm?.action === "reject"
            ? `Are you sure you want to reject "${confirm?.request?.name}"? This cannot be undone.`
            : `"${confirm?.request?.name}" will be created and the requester becomes its ${confirm?.request?.creator_role}.`
        }
        confirmLabel={confirm?.action === "reject" ? "Reject request" : "Approve request"}
        destructive={confirm?.action === "reject"}
        loading={Boolean(processingId)}
        onConfirm={() => confirm && act(confirm.request, confirm.action)}
        onClose={() => !processingId && setConfirm(null)}
      />

      <Card>
        <CardHeader
          title="Audit trails"
          description="Recent activity across the ChamaLedger platform."
        />

        {auditError ? (
          <CardBody>
            <EmptyState
              title="Unable to load audit trails"
              description={auditError}
              action={
                <Button variant="outline" onClick={refetchAudit}>
                  Try again
                </Button>
              }
            />
          </CardBody>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <Table
              columns={auditColumns}
              rows={Array.isArray(auditData) ? auditData : []}
              loading={auditLoading}
              caption="Platform audit trails"
              emptyTitle="No audit activity yet"
              emptyDescription="Admin activities will appear here."
            />
          </div>
        )}
      </Card>
    </div>
  );
}

export default AdminDashboard;
