import { createFileRoute } from "@tanstack/react-router";

import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import UnauthorizedPage from "../pages/misc/UnauthorizedPage";

/** /unauthorized — signed in, but the role is not allowed for the target page. */
export const Route = createFileRoute("/unauthorized")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Access denied — ChamaLedger" },
      {
        name: "description",
        content: "Your account role does not grant access to this section of ChamaLedger.",
      },
      { property: "og:title", content: "Access denied — ChamaLedger" },
      {
        property: "og:description",
        content: "Ask an admin to upgrade your role to reach this section.",
      },
    ],
  }),
  component: UnauthorizedRoute,
});

function UnauthorizedRoute() {
  return (
    <ProtectedRoute>
      <Layout>
        <UnauthorizedPage />
      </Layout>
    </ProtectedRoute>
  );
}
