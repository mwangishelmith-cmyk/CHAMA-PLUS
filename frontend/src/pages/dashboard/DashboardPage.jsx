import useAuth from "../../hooks/useAuth";
import { useChama } from "../../context/ChamaContext";
import AdminDashboard from "./AdminDashboard";
import OnboardingDashboard from "./OnboardingDashboard";
import PendingDashboard from "./PendingDashboard";
import SelectChamaDashboard from "./SelectChamaDashboard";
import MemberDashboard from "./MemberDashboard";

/**
 * /dashboard — renders exactly one of four states, in this order:
 *
 *  A. Super admin        -> chama creation approvals (no member financial data)
 *  B. No membership      -> join / create onboarding (or pending status)
 *  C. Current chama      -> member dashboard
 *  D. Multiple chamas    -> chama picker only
 */
export function DashboardPage() {
  const { isSuperAdmin, hasMembership, hasPendingRequest } = useAuth();
  const { needsSelection, hasMultiple, membership } = useChama();

  if (isSuperAdmin) return <AdminDashboard />;
  if (!hasMembership) {
    return hasPendingRequest ? <PendingDashboard /> : <OnboardingDashboard />;
  }
  if (hasMultiple && (needsSelection || !membership)) return <SelectChamaDashboard />;
  return <MemberDashboard />;
}

export default DashboardPage;
