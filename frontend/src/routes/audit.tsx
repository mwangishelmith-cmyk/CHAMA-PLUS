import { createFileRoute } from "@tanstack/react-router";

import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import AuditPage from "../pages/audit/AuditPage";
import { ROLES } from "../lib/roles";

/** /audit — officials only. */
export const Route = createFileRoute("/audit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Audit trail — ChamaLedger" },
      { name: "description", content: "Read-only audit trail of administrative actions." },
      { property: "og:title", content: "Audit trail — ChamaLedger" },
      { property: "og:description", content: "Read-only audit trail of administrative actions." },
    ],
  }),
  component: AuditRoute,
});

function AuditRoute() {
  return (
    <ProtectedRoute requireMembership roles={[ROLES.CHAIRPERSON, ROLES.TREASURER]}>
      <Layout>
        <AuditPage />
      </Layout>
    </ProtectedRoute>
  );
}
