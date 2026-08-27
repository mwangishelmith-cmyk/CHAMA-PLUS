import { useCallback, useState } from "react";

import chamaApi from "../../api/chamas";
import { getErrorMessage } from "../../api/client";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/common/StatusBadge";
import Table from "../../components/common/Table";
import { useChama } from "../../context/ChamaContext";
import { useToast } from "../../context/ToastContext";
import useApiResource from "../../hooks/useApiResource";
import { isOfficial, roleLabel } from "../../lib/roles";

const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");

/**
 * /members — the CURRENT chama's member directory.
 * Officials (Chairperson/Treasurer) additionally see the pending join-request
 * queue with approve/reject actions.
 */
export function MembersPage() {
  const toast = useToast();
  const { chamaId, role } = useChama();
  const official = isOfficial(role);

  const membersFetcher = useCallback(
    () => (chamaId ? chamaApi.members(chamaId) : Promise.resolve([])),
    [chamaId],
  );
  const members = useApiResource(membersFetcher, { enabled: Boolean(chamaId), initialData: [] });

  const requestsFetcher = useCallback(
    () => (chamaId && official ? chamaApi.pendingJoinRequests(chamaId) : Promise.resolve([])),
    [chamaId, official],
  );
  const requests = useApiResource(requestsFetcher, {
    enabled: Boolean(chamaId && official),
    initialData: [],
  });

  const [confirm, setConfirm] = useState(null); // { request, action }
  const [processingId, setProcessingId] = useState(null);

  const act = async (request, action) => {
    setProcessingId(request.id);
    try {
      if (action === "approve") await chamaApi.approveJoinRequest(chamaId, request.id);
      else await chamaApi.rejectJoinRequest(chamaId, request.id);
      toast.success(
        action === "approve"
          ? `${request.full_name || "The applicant"} is now a member.`
          : "Join request rejected.",
      );
      setConfirm(null);
      await Promise.all([requests.refetch(), members.refetch()]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const memberColumns = [
    { key: "full_name", header: "Member" },
    { key: "phone_number", header: "Phone", className: "whitespace-nowrap", render: (r) => r.phone_number || "—" },
    { key: "role", header: "Role", render: (r) => <StatusBadge status={r.role}>{roleLabel(r.role)}</StatusBadge> },
    { key: "joined_date", header: "Joined", className: "whitespace-nowrap", render: (r) => formatDate(r.joined_date) },
  ];

  const requestColumns = [
    { key: "full_name", header: "Applicant", render: (r) => r.full_name || r.user_name || r.user_id },
    { key: "created_at", header: "Requested", className: "whitespace-nowrap", render: (r) => formatDate(r.created_at) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={String(r.status || "pending").toLowerCase()}>{r.status}</StatusBadge> },
    {
      key: "actions",
      header: "Actions",
      className: "whitespace-nowrap",
      render: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={processingId === row.id}
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
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone in this chama, with the role assigned to them.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={members.refetch} loading={members.loading}>
          Refresh
        </Button>
      </div>

      {members.error ? (
        <Card>
          <CardBody>
            <EmptyState
              title="We couldn't load the members"
              description={members.error}
              action={
                <Button variant="outline" onClick={members.refetch}>
                  Try again
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Member directory"
            description="Roles are assigned by officials and enforced by the backend on every request."
          />
          <Table
            columns={memberColumns}
            rows={members.data || []}
            loading={members.loading}
            caption="Chama members"
            emptyTitle="No members yet"
            emptyDescription="Approved members will appear here."
          />
        </Card>
      )}

      {official && (
        <Card>
          <CardHeader
            title="Join requests"
            description="Applicants waiting for review by a chairperson or treasurer."
            action={
              <Button variant="outline" size="sm" onClick={requests.refetch} loading={requests.loading}>
                Refresh
              </Button>
            }
          />
          {requests.error ? (
            <CardBody>
              <EmptyState title="We couldn't load join requests" description={requests.error} />
            </CardBody>
          ) : (
            <Table
              columns={requestColumns}
              rows={requests.data || []}
              loading={requests.loading}
              caption="Pending join requests"
              emptyTitle="No pending requests"
              emptyDescription="New applicants will appear here."
            />
          )}
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === "reject" ? "Reject this applicant?" : "Approve this applicant?"}
        description={
          confirm?.action === "reject"
            ? "The applicant will be notified that their request was rejected."
            : "A member profile will be created and the applicant gains member access."
        }
        confirmLabel={confirm?.action === "reject" ? "Reject" : "Approve"}
        destructive={confirm?.action === "reject"}
        loading={Boolean(processingId)}
        onConfirm={() => confirm && act(confirm.request, confirm.action)}
        onClose={() => !processingId && setConfirm(null)}
      />
    </div>
  );
}

export default MembersPage;
