import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * "/" simply forwards to the dashboard. The dashboard is protected, so
 * unauthenticated visitors end up on /login automatically.
 */
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
