import { useCallback, useState } from "react";

import ledgerApi from "../../api/ledger";
import { getErrorMessage, isNotImplemented } from "../../api/client";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import EmptyState from "../../components/common/EmptyState";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import StatusBadge from "../../components/common/StatusBadge";
import Table from "../../components/common/Table";
import Select from "../../components/common/Select";
import { useChama } from "../../context/ChamaContext";
import { useToast } from "../../context/ToastContext";
import useApiResource from "../../hooks/useApiResource";
import { isTreasurer } from "../../lib/roles";
import chamaApi from "../../api/chamas";

const formatKes = (value) =>
  value == null ? "—" : `KES ${Number(value).toLocaleString("en-KE")}`;
const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");

const PAYMENT_METHODS = [
  { value: "M-Pesa", label: "M-Pesa" },
  { value: "Bank transfer", label: "Bank transfer" },
  { value: "Cash", label: "Cash" },
];

/**
 * /ledger — the member's own statement for the current chama.
 * Treasurers additionally get a "Record payment" form and the all-members
 * ledger (both are treasurer-only endpoints on the backend).
 */
export function LedgerPage() {
  const toast = useToast();
  const { chamaId, memberId, role } = useChama();
  const treasurer = isTreasurer(role);

  const statementFetcher = useCallback(
    () =>
      chamaId && memberId
        ? ledgerApi.memberStatement(chamaId, memberId)
        : Promise.resolve(null),
    [chamaId, memberId],
  );
  const statement = useApiResource(statementFetcher, {
    enabled: Boolean(chamaId && memberId),
  });

  // Treasurer-only: full chama ledger + member list for the payment form.
  const allMembersFetcher = useCallback(async () => {
    if (!chamaId || !treasurer) return null;
    try {
      return await ledgerApi.allMembers(chamaId);
    } catch (error) {
      if (isNotImplemented(error)) return null;
      throw error;
    }
  }, [chamaId, treasurer]);
  const allMembers = useApiResource(allMembersFetcher, {
    enabled: Boolean(chamaId && treasurer),
  });

  const membersFetcher = useCallback(
    () => (chamaId && treasurer ? chamaApi.members(chamaId) : Promise.resolve([])),
    [chamaId, treasurer],
  );
  const members = useApiResource(membersFetcher, {
    enabled: Boolean(chamaId && treasurer),
    initialData: [],
  });

  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({ member_id: "", amount: "", reference: "", payment_method: "M-Pesa" });

  const submitPayment = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      await ledgerApi.recordPayment(chamaId, {
        member_id: form.member_id,
        amount: Number(form.amount),
        reference: form.reference,
        payment_method: form.payment_method,
      });
      toast.success("Payment recorded.");
      setPayOpen(false);
      setForm({ member_id: "", amount: "", reference: "", payment_method: "M-Pesa" });
      await Promise.all([statement.refetch(), allMembers.refetch()]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const rows = statement.data?.statement || [];
  const allMemberRows = Array.isArray(allMembers.data)
    ? allMembers.data
    : allMembers.data?.members || allMembers.data?.statements || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your personal statement in this chama.
          </p>
        </div>
        {treasurer && (
          <Button onClick={() => setPayOpen(true)}>Record payment</Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Total payments</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKes(statement.data?.payments)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Fines</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKes(statement.data?.fines)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Outstanding debt</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatKes(statement.data?.outstanding_debt)}
            </p>
          </CardBody>
        </Card>
      </div>

      {statement.error ? (
        <Card>
          <CardBody>
            <EmptyState
              title="We couldn't load your statement"
              description={statement.error}
              action={
                <Button variant="outline" onClick={statement.refetch}>
                  Try again
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Statement"
            description="Every ledger entry recorded against your membership."
            action={
              <Button variant="outline" size="sm" onClick={statement.refetch} loading={statement.loading}>
                Refresh
              </Button>
            }
          />
          <div className="max-h-[32rem] overflow-y-auto">
            <Table
              columns={[
                { key: "date", header: "Date", className: "whitespace-nowrap", render: (r) => formatDate(r.date) },
                { key: "description", header: "Description", render: (r) => r.description || r.type },
                { key: "type", header: "Type", render: (r) => <StatusBadge status={String(r.type || "").toLowerCase()}>{r.type}</StatusBadge> },
                { key: "amount", header: "Amount", className: "whitespace-nowrap", render: (r) => formatKes(r.amount) },
              ]}
              rows={rows}
              loading={statement.loading}
              caption="Your ledger statement"
              emptyTitle="No ledger entries yet"
              emptyDescription="Payments and contributions will appear here."
            />
          </div>
        </Card>
      )}

      {treasurer && (
        <Card>
          <CardHeader
            title="All members"
            description="Treasurer view of every member's position."
            action={
              <Button variant="outline" size="sm" onClick={allMembers.refetch} loading={allMembers.loading}>
                Refresh
              </Button>
            }
          />
          {allMembers.error ? (
            <CardBody>
              <EmptyState title="We couldn't load the chama ledger" description={allMembers.error} />
            </CardBody>
          ) : (
            <Table
              columns={[
                { key: "full_name", header: "Member", render: (r) => r.full_name || r.member_id },
                { key: "payments", header: "Payments", className: "whitespace-nowrap", render: (r) => formatKes(r.payments ?? r.total_payments) },
                { key: "outstanding_debt", header: "Debt", className: "whitespace-nowrap", render: (r) => formatKes(r.outstanding_debt ?? r.debt) },
              ]}
              rows={allMemberRows}
              loading={allMembers.loading}
              caption="All members ledger"
              emptyTitle="No data"
              emptyDescription="Member positions will appear once payments are recorded."
            />
          )}
        </Card>
      )}

      <Modal
        open={payOpen}
        onClose={() => !paying && setPayOpen(false)}
        title="Record payment"
        description="Log a contribution payment for a member. Treasurer only."
        footer={
          <>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>
              Cancel
            </Button>
            <Button form="payment-form" type="submit" loading={paying} disabled={paying}>
              Save payment
            </Button>
          </>
        }
      >
        <form id="payment-form" onSubmit={submitPayment} className="space-y-4">
          <Select
            label="Member"
            value={form.member_id}
            onChange={(e) => setForm((v) => ({ ...v, member_id: e.target.value }))}
            required
          >
            <option value="" disabled>
              Select a member…
            </option>
            {(members.data || []).map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.full_name}
              </option>
            ))}
          </Select>
          <Input
            label="Amount (KES)"
            type="number"
            min="1"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))}
            required
          />
          <Select
            label="Payment method"
            value={form.payment_method}
            onChange={(e) => setForm((v) => ({ ...v, payment_method: e.target.value }))}
            options={PAYMENT_METHODS}
          />
          <Input
            label="Reference"
            value={form.reference}
            onChange={(e) => setForm((v) => ({ ...v, reference: e.target.value }))}
            placeholder="M-Pesa code, receipt no…"
          />
        </form>
      </Modal>
    </div>
  );
}

export default LedgerPage;
