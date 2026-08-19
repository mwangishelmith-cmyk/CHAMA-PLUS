import { createFileRoute } from "@tanstack/react-router";

import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import DashboardPage from "../pages/dashboard/DashboardPage";

/** /dashboard — protected route wrapped in the app shell. */
export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — ChamaLedger" },
      {
        name: "description",
        content: "Overview of your chama balances, contributions and recent ledger activity.",
      },
      { property: "og:title", content: "Dashboard — ChamaLedger" },
      {
        property: "og:description",
        content: "Track balances, contributions and member activity at a glance.",
      },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <ProtectedRoute>
      <Layout>
        <DashboardPage />
      </Layout>
    </ProtectedRoute>
  );
}
