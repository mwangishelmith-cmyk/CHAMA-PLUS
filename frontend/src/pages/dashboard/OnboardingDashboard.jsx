import { PlusCircle, Users } from "lucide-react";
import { useCallback, useState } from "react";

import chamaApi from "../../api/chamas";
import { getErrorMessage, isNotImplemented } from "../../api/client";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import useApiResource from "../../hooks/useApiResource";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { CREATOR_ROLES } from "../../lib/roles";

/**
 * STATE B — authenticated user with no member profile.
 *
 * No financial data is shown. The user can either request to join an existing
 * chama (`POST /chamas/{id}/join`) or request a new one
 * (`POST /chamas` — which creates a PENDING ChamaCreationRequest, not a chama).
 */
export function OnboardingDashboard() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [openForm, setOpenForm] = useState(null); // "join" | "create"
  const [submitting, setSubmitting] = useState(false);

  const directoryFetcher = useCallback(async () => {
    try {
      return await chamaApi.directory();
    } catch (error) {
      if (isNotImplemented(error)) return null; // endpoint not deployed yet
      throw error;
    }
  }, []);
  const { data: directory, loading: directoryLoading } = useApiResource(directoryFetcher);

  const [joinValues, setJoinValues] = useState({ chama_id: "" });
  const [createValues, setCreateValues] = useState({
    name: "",
    chama_type: "",
    description: "",
    creator_role: CREATOR_ROLES[0],
    default_contribution_amount: "",
  });

  const submitJoin = async (e) => {
    e.preventDefault();
    if (!joinValues.chama_id) return;
    setSubmitting(true);
    try {
      await chamaApi.requestJoin(joinValues.chama_id.trim());
      toast.success("Join request submitted. A chama official will review it.");
      setOpenForm(null);
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await chamaApi.requestCreation({
        ...createValues,
        default_contribution_amount: createValues.default_contribution_amount || null,
      });
      toast.success("Chama creation request submitted for approval.");
      setOpenForm(null);
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Karibu, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are not part of a chama yet. Join an existing one or start your own.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Get started"
          description="Both options need approval before you get access to a chama dashboard."
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setOpenForm("join")}
              className="rounded-xl border border-border p-5 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Users className="h-6 w-6 text-primary" aria-hidden="true" />
              <p className="mt-3 font-semibold text-foreground">Join Chama</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a membership request to an existing chama.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setOpenForm("create")}
              className="rounded-xl border border-border p-5 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PlusCircle className="h-6 w-6 text-primary" aria-hidden="true" />
              <p className="mt-3 font-semibold text-foreground">Create Chama</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Request a new chama; a platform administrator approves it.
              </p>
            </button>
          </div>
        </CardBody>
      </Card>

      {/* --- Join chama ------------------------------------------------- */}
      <Modal
        open={openForm === "join"}
        onClose={() => !submitting && setOpenForm(null)}
        title="Join a chama"
        description="Your request is reviewed by the chama's chairperson or treasurer."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenForm(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button form="join-form" type="submit" loading={submitting} disabled={submitting}>
              Send request
            </Button>
          </>
        }
      >
        <form id="join-form" onSubmit={submitJoin} className="space-y-4">
          {directoryLoading ? (
            <p className="text-sm text-muted-foreground">Loading chamas…</p>
          ) : directory && directory.length ? (
            <Select
              label="Chama"
              value={joinValues.chama_id}
              onChange={(e) => setJoinValues({ chama_id: e.target.value })}
              required
            >
              <option value="" disabled>
                Select a chama…
              </option>
              {directory.map((c) => (
                <option key={c.chama_id || c.id} value={c.chama_id || c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label="Chama ID"
              value={joinValues.chama_id}
              onChange={(e) => setJoinValues({ chama_id: e.target.value })}
              placeholder="952e5246-bc31-4730-b141-7983bf32cbf2"
              hint="Ask a chama official for the chama ID."
              required
            />
          )}
        </form>
      </Modal>

      {/* --- Create chama ----------------------------------------------- */}
      <Modal
        open={openForm === "create"}
        onClose={() => !submitting && setOpenForm(null)}
        title="Create a chama"
        description="Submitted as a creation request for platform approval."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenForm(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button form="create-form" type="submit" loading={submitting} disabled={submitting}>
              Submit request
            </Button>
          </>
        }
      >
        <form id="create-form" onSubmit={submitCreate} className="space-y-4">
          <Input
            label="Chama name"
            value={createValues.name}
            onChange={(e) => setCreateValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
          <Input
            label="Chama type"
            value={createValues.chama_type}
            onChange={(e) => setCreateValues((v) => ({ ...v, chama_type: e.target.value }))}
            placeholder="Savings, Investment, Welfare…"
            required
          />
          <Input
            label="Description"
            value={createValues.description}
            onChange={(e) => setCreateValues((v) => ({ ...v, description: e.target.value }))}
          />
          <Select
            label="Your role in this chama"
            value={createValues.creator_role}
            onChange={(e) => setCreateValues((v) => ({ ...v, creator_role: e.target.value }))}
            options={CREATOR_ROLES.map((r) => ({ value: r, label: r }))}
            hint="Backend accepts Chairperson, Treasurer or Secretary."
          />
          <Input
            label="Default contribution amount (KES)"
            type="number"
            min="0"
            step="0.01"
            value={createValues.default_contribution_amount}
            onChange={(e) =>
              setCreateValues((v) => ({ ...v, default_contribution_amount: e.target.value }))
            }
          />
        </form>
      </Modal>
    </div>
  );
}

export default OnboardingDashboard;
