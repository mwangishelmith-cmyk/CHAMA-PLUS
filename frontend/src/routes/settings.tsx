import { createFileRoute } from "@tanstack/react-router";

import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import SettingsPage from "../pages/settings/SettingsPage";

/** /settings — chama configuration. */
export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chama settings — ChamaLedger" },
      { name: "description", content: "Configure contribution and fine rules for your chama." },
      { property: "og:title", content: "Chama settings — ChamaLedger" },
      { property: "og:description", content: "Configure contribution and fine rules for your chama." },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <ProtectedRoute requireMembership>
      <Layout>
        <SettingsPage />
      </Layout>
    </ProtectedRoute>
  );
}
