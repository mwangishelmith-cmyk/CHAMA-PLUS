import Card, { CardBody, CardHeader } from "../../components/common/Card";
import ChamaSwitcher from "../../components/chama/ChamaSwitcher";
import useAuth from "../../hooks/useAuth";

/**
 * STATE D — the user belongs to several chamas and none is selected yet.
 * Only the picker is shown; every other page unlocks once a chama is chosen.
 */
export function SelectChamaDashboard() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Karibu, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You belong to more than one chama. Choose which one to work with.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Select a chama"
          description="Your choice is remembered on this browser."
        />
        <CardBody>
          <ChamaSwitcher label="Chama" />
        </CardBody>
      </Card>
    </div>
  );
}

export default SelectChamaDashboard;
