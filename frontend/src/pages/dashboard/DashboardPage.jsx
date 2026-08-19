import { Plus, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import dashboardApi from "../../api/dashboard";
import { getErrorMessage } from "../../api/client";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Modal from "../../components/common/Modal";
import StatusBadge from "../../components/common/StatusBadge";
import Table from "../../components/common/Table";
import Input from "../../components/common/Input";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";

const COLUMNS = [
  { key: "member", header: "Member" },
  { key: "type", header: "Type" },
  { key: "amount", header: "Amount", className: "whitespace-nowrap" },
  { key: "date", header: "Date", className: "whitespace-nowrap" },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
];

/** /dashboard — protected overview page. */
export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.summary());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recordContribution = (e) => {
    e.preventDefault();
    setModalOpen(false);
    setAmount("");
    toast.success("Contribution recorded.");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Habari, {user?.name?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here is how your group is doing this month.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Record contribution
        </Button>
      </div>

      {/* Error state with retry */}
      {error && (
        <Card>
          <CardBody>
            <EmptyState
              title="We couldn't load your dashboard"
              description={error}
              action={
                <Button variant="outline" onClick={load}>
                  Try again
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {/* Stat cards */}
      {loading && !data ? (
        <LoadingSpinner center size="lg" label="Loading dashboard" />
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.stats.map((stat) => (
                <Card key={stat.id}>
                  <CardBody>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      {stat.change} vs last month
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader
                title="Recent activity"
                description="Latest ledger entries across your chamas."
                action={
                  <Button variant="outline" size="sm" onClick={load} loading={loading}>
                    Refresh
                  </Button>
                }
              />
              <Table
                columns={COLUMNS}
                rows={data.activity}
                loading={loading}
                caption="Recent ledger entries"
                emptyTitle="No transactions yet"
                emptyDescription="Contributions will show up here as soon as they are recorded."
              />
            </Card>
          </>
        )
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record contribution"
        description="Log a member contribution against the current cycle."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button form="contribution-form" type="submit">
              Save
            </Button>
          </>
        }
      >
        <form id="contribution-form" onSubmit={recordContribution} className="space-y-4">
          <Input
            label="Amount (KES)"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            required
          />
        </form>
      </Modal>
    </div>
  );
}

export default DashboardPage;
