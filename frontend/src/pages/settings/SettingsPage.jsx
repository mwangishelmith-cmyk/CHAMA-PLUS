import { useCallback, useEffect, useState } from "react";

import chamaApi from "../../api/chamas";
import { getErrorMessage, isNotImplemented } from "../../api/client";
import Button from "../../components/common/Button";
import Card, { CardBody, CardHeader } from "../../components/common/Card";
import EmptyState from "../../components/common/EmptyState";
import Input from "../../components/common/Input";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useChama } from "../../context/ChamaContext";
import { useToast } from "../../context/ToastContext";
import { isOfficial } from "../../lib/roles";

/**
 * /settings — chama configuration (contribution + fine rules).
 * Readable by any member; editable by officials. If the settings endpoint is
 * not deployed on the backend yet, the page says so instead of breaking.
 */
export function SettingsPage() {
  const toast = useToast();
  const { chamaId, role } = useChama();
  const canEdit = isOfficial(role);

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!chamaId) return;
    setLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      setSettings(await chamaApi.settings(chamaId));
    } catch (err) {
      if (isNotImplemented(err)) setUnavailable(true);
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (field) => (e) =>
    setSettings((s) => ({ ...s, [field]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await chamaApi.updateSettings(chamaId, {
        default_contribution_amount: Number(settings.default_contribution_amount) || 0,
        contribution_frequency: settings.contribution_frequency,
        late_fine_amount: Number(settings.late_fine_amount) || 0,
        grace_period_days: Number(settings.grace_period_days) || 0,
      });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner center size="lg" label="Loading settings" />;

  if (unavailable) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardBody>
            <EmptyState
              title="Settings API not available yet"
              description="The chama settings endpoint is not deployed on the backend yet. Ask your backend team to expose GET/PUT /chamas/{id}/settings."
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardBody>
            <EmptyState
              title="We couldn't load the settings"
              description={error}
              action={
                <Button variant="outline" onClick={load}>
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Chama settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit
            ? "Configure contribution rules for this chama."
            : "Contribution rules for this chama. Only officials can edit them."}
        </p>
      </div>

      <Card>
        <CardHeader title="Contribution rules" />
        <CardBody>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Default contribution (KES)"
              type="number"
              min="0"
              step="0.01"
              value={settings?.default_contribution_amount ?? ""}
              onChange={update("default_contribution_amount")}
              disabled={!canEdit}
            />
            <Input
              label="Contribution frequency"
              value={settings?.contribution_frequency ?? ""}
              onChange={update("contribution_frequency")}
              placeholder="Monthly"
              disabled={!canEdit}
            />
            <Input
              label="Late fine amount (KES)"
              type="number"
              min="0"
              step="0.01"
              value={settings?.late_fine_amount ?? ""}
              onChange={update("late_fine_amount")}
              disabled={!canEdit}
            />
            <Input
              label="Grace period (days)"
              type="number"
              min="0"
              value={settings?.grace_period_days ?? ""}
              onChange={update("grace_period_days")}
              disabled={!canEdit}
            />
            {canEdit && (
              <div className="sm:col-span-2">
                <Button type="submit" loading={saving} disabled={saving}>
                  Save settings
                </Button>
              </div>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export default SettingsPage;
