import { createFileRoute } from "@tanstack/react-router";

import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import ReportsPage from "../pages/reports/ReportsPage";
import { ROLES } from "../lib/roles";

/** /reports — admin + treasurer route. */
export const Route = createFileRoute("/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Financial reports — ChamaLedger" },
      {
        name: "description",
        content: "Contribution and loan summaries per cycle, for admins and treasurers.",
      },
      { property: "og:title", content: "Financial reports — ChamaLedger" },
      {
        property: "og:description",
        content: "Review monthly contributions, loans issued and the net position.",
      },
    ],
  }),
  component: ReportsRoute,
});

function ReportsRoute() {
  return (
    <ProtectedRoute requireMembership roles={[ROLES.CHAIRPERSON, ROLES.TREASURER]}>
      <Layout>
        <ReportsPage />
      </Layout>
    </ProtectedRoute>
  );
}
