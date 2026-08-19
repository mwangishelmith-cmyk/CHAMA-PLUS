import { createFileRoute } from "@tanstack/react-router";

import LoginPage from "../pages/auth/LoginPage";

/** /login?redirect=/some/path */
export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — ChamaLedger" },
      {
        name: "description",
        content: "Sign in to ChamaLedger to manage your group savings, contributions and ledger.",
      },
      { property: "og:title", content: "Sign in — ChamaLedger" },
      {
        property: "og:description",
        content: "Secure access to your chama's shared savings ledger.",
      },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const search = Route.useSearch();
  return <LoginPage redirectTo={search.redirect || "/dashboard"} />;
}
