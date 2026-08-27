import { Download } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ledgerApi from "../../api/ledger";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import EmptyState from "../../components/common/EmptyState";
import Table from "../../components/common/Table";
import { useChama } from "../../context/ChamaContext";
import useApiResource from "../../hooks/useApiResource";
import { useToast } from "../../context/ToastContext";

const formatKes = (value) =>
  value == null ? "—" : `KES ${Number(value).toLocaleString("en-KE")}`;

const monthKey = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Unknown"
    : d.toLocaleDateString("en-KE", { year: "numeric", month: "short" });
};

/** Build a client-side CSV download from fetched rows (no extra endpoint needed). */
function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * /reports — officials only. Aggregates the chama ledger (all-member entries)
 * into monthly charts and offers a CSV statement download.
 */
export function ReportsPage() {
  const toast = useToast();
  const { chamaId } = useChama();

  const entriesFetcher = useCallback(
    () => (chamaId ? ledgerApi.chamaEntries(chamaId) : Promise.resolve(null)),
    [chamaId],
  );
  const { data, loading, error, refetch } = useApiResource(entriesFetcher, {
    enabled: Boolean(chamaId),
  });

  const entries = useMemo(
    () => (Array.isArray(data) ? data : data?.entries || []),
    [data],
  );

  const monthly = useMemo(() => {
    const buckets = new Map();
    for (const e of entries) {
      const key = monthKey(e.date || e.created_at);
      const bucket = buckets.get(key) || { month: key, contributions: 0, fines: 0 };
      const amount = Number(e.amount) || 0;
      if (String(e.type || "").toLowerCase().includes("fine")) bucket.fines += amount;
      else bucket.contributions += amount;
      buckets.set(key, bucket);
    }
    return [...buckets.values()];
  }, [entries]);

  const totals = useMemo(
    () =>
      monthly.reduce(
        (acc, m) => ({
          contributions: acc.contributions + m.contributions,
          fines: acc.fines + m.fines,
        }),
        { contributions: 0, fines: 0 },
      ),
    [monthly],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chama-wide contribution and fine summaries. Officials only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch} loading={loading}>
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!entries.length}
            onClick={() => {
              downloadCsv("chama-statement.csv", entries);
              toast.success("Statement downloaded.");
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download statement
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardBody>
            <EmptyState
              title="We couldn't load the reports"
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
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardBody>
                <p className="text-sm text-muted-foreground">Total contributions</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatKes(totals.contributions)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-muted-foreground">Total fines</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatKes(totals.fines)}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Monthly activity"
              description="Contributions and fines grouped by month."
            />
            <CardBody>
              {monthly.length === 0 && !loading ? (
                <EmptyState
                  title="No report data yet"
                  description="Charts appear once ledger entries exist."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.5rem",
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="contributions" name="Contributions" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="fines" name="Fines" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ledger entries" description="The raw entries behind the charts." />
            <div className="max-h-[28rem] overflow-y-auto">
              <Table
                columns={[
                  { key: "date", header: "Date", className: "whitespace-nowrap", render: (r) => String(r.date || r.created_at || "").slice(0, 10) },
                  { key: "member", header: "Member", render: (r) => r.full_name || r.member_id },
                  { key: "description", header: "Description", render: (r) => r.description || r.type },
                  { key: "amount", header: "Amount", className: "whitespace-nowrap", render: (r) => formatKes(r.amount) },
                ]}
                rows={entries}
                loading={loading}
                caption="Chama ledger entries"
                emptyTitle="No entries yet"
                emptyDescription="Recorded payments will appear here."
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default ReportsPage;
