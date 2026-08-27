import { TrendingUp } from "lucide-react";
import { useCallback } from "react";

import chamaApi from "../../api/chamas";
import ledgerApi from "../../api/ledger";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/common/StatusBadge";
import Table from "../../components/common/Table";
import { useChama } from "../../context/ChamaContext";
import useApiResource from "../../hooks/useApiResource";
import { roleLabel } from "../../lib/roles";

const formatKes = (value) =>
  value == null ? "—" : `KES ${Number(value).toLocaleString("en-KE")}`;

const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");

/**
 * STATE C — the user has a current chama selected.
 *
 * All figures come from the member's own ledger statement plus the chama
 * balance endpoint (officials only — its 403 is tolerated).
 */
export function MemberDashboard() {
  const { chamaId, memberId, role, membership } = useChama();

  const statementFetcher = useCallback(() => {
    if (!chamaId || !memberId) return Promise.resolve(null);
    return ledgerApi.memberStatement(chamaId, memberId);
  }, [chamaId, memberId]);
  const {
    data: statement,
    loading: statementLoading,
    error: statementError,
    refetch,
  } = useApiResource(statementFetcher, { enabled: Boolean(chamaId && memberId) });

  // Chama overview (members_count, total_balance) — any member may read it.
  const detailFetcher = useCallback(
    () => (chamaId ? chamaApi.detail(chamaId) : Promise.resolve(null)),
    [chamaId],
  );
  const { data: detail } = useApiResource(detailFetcher, { enabled: Boolean(chamaId) });

  const chamaName =
    membership?.chama_name || detail?.chama_details?.name || "Your chama";
  const transactions = statement?.statement || [];

  if (statementLoading && !statement) {
    return <LoadingSpinner center size="lg" label="Loading your dashboard" />;
  }

  if (statementError) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardBody>
            <EmptyState
              title="We couldn't load your ledger"
              description={statementError}
              action={
                <Button variant="outline" onClick={refetch}>
                  Try again
                </Button>
              }
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{chamaName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your role: {roleLabel(role)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Your total contributions</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKes(statement?.payments)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Outstanding debt</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKes(statement?.outstanding_debt)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Fines</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKes(statement?.fines)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Chama members</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {detail?.members_count ?? "—"}
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Chama balance {formatKes(detail?.total_balance)}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent activity"
          description="Latest entries on your personal ledger."
          action={
            <Button variant="outline" size="sm" onClick={refetch} loading={statementLoading}>
              Refresh
            </Button>
          }
        />
        <Table
          columns={[
            { key: "date", header: "Date", className: "whitespace-nowrap", render: (r) => formatDate(r.date) },
            { key: "description", header: "Description", render: (r) => r.description || r.type },
            { key: "type", header: "Type", render: (r) => <StatusBadge status={String(r.type || "").toLowerCase()}>{r.type}</StatusBadge> },
            { key: "amount", header: "Amount", className: "whitespace-nowrap", render: (r) => formatKes(r.amount) },
          ]}
          rows={transactions.slice(0, 10)}
          loading={statementLoading}
          caption="Your recent ledger entries"
          emptyTitle="No activity yet"
          emptyDescription="Your contributions will appear here once recorded."
        />
      </Card>
    </div>
  );
}

export default MemberDashboard;
