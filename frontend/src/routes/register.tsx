import { createFileRoute } from "@tanstack/react-router";

import RegisterPage from "../pages/auth/RegisterPage";

/** /register */
export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create account — ChamaLedger" },
      {
        name: "description",
        content: "Create a ChamaLedger account to track contributions, loans and member balances.",
      },
      { property: "og:title", content: "Create account — ChamaLedger" },
      {
        property: "og:description",
        content: "Start tracking your chama's savings in minutes.",
      },
    ],
  }),
  component: () => <RegisterPage redirectTo="/dashboard" />,
});
