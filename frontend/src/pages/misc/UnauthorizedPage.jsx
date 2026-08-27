import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import Card, { CardBody } from "../../components/common/Card";
import EmptyState from "../../components/common/EmptyState";
import { useChama } from "../../context/ChamaContext";
import { roleLabel } from "../../lib/roles";

/** /unauthorized — shown when a signed-in user lacks the required role. */
export function UnauthorizedPage() {
  const { role, membership } = useChama();
  const currentRole = membership ? roleLabel(role) : "unknown";

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardBody>
          <EmptyState
            icon={ShieldAlert}
            title="You don't have access to this section"
            description={`Your role in this chama is ${currentRole}. Ask a chama official to change your role if you need access.`}
            action={
              <Link
                to="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Back to dashboard
              </Link>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default UnauthorizedPage;

