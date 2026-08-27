import { createFileRoute } from "@tanstack/react-router";

import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import LedgerPage from "../pages/ledger/LedgerPage";

/** /ledger — any member of the current chama. */
export const Route = createFileRoute("/ledger")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ledger — ChamaLedger" },
      { name: "description", content: "Your personal ledger statement and chama payment records." },
      { property: "og:title", content: "Ledger — ChamaLedger" },
      { property: "og:description", content: "Track your contributions, fines and debt." },
    ],
  }),
  component: LedgerRoute,
});

function LedgerRoute() {
  return (
    <ProtectedRoute requireMembership>
      <Layout>
        <LedgerPage />
      </Layout>
    </ProtectedRoute>
  );
}
