import { createFileRoute } from "@tanstack/react-router";

import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import MembersPage from "../pages/admin/MembersPage";

/** /members — admin-only route. */
export const Route = createFileRoute("/members")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Members — ChamaLedger" },
      {
        name: "description",
        content: "Admin-only directory of chama members and their assigned roles.",
      },
      { property: "og:title", content: "Members — ChamaLedger" },
      {
        property: "og:description",
        content: "Manage who belongs to your chama and what each member can access.",
      },
    ],
  }),
  component: MembersRoute,
});

function MembersRoute() {
  return (
    <ProtectedRoute requireMembership>
      <Layout>
        <MembersPage />
      </Layout>
    </ProtectedRoute>
  );
}
