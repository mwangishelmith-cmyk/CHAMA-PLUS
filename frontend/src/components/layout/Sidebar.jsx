import PropTypes from "prop-types";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { cn } from "../../lib/utils";
import useAuth from "../../hooks/useAuth";
import { useChama } from "../../context/ChamaContext";
import ChamaSwitcher from "../chama/ChamaSwitcher";
import { ROLES, roleIn } from "../../lib/roles";

const OFFICIALS = [ROLES.CHAIRPERSON, ROLES.TREASURER];

/**
 * Primary navigation. Item visibility mirrors the backend's authorisation:
 *  - super admins only get platform pages (member pages 403 for them anyway),
 *  - users without membership only see the dashboard (onboarding),
 *  - officials-only pages are hidden from plain members.
 */
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, audience: "all" },
  { to: "/ledger", label: "Ledger", icon: Wallet, audience: "member" },
  { to: "/members", label: "Members", icon: Users, audience: "member" },
  { to: "/reports", label: "Reports", icon: BarChart3, audience: "official" },
  { to: "/settings", label: "Settings", icon: Settings, audience: "official" },
  { to: "/audit", label: "Audit trail", icon: ClipboardList, audience: "official" },
];

function NavList({ onNavigate }) {
  const { isSuperAdmin, hasMembership } = useAuth();
  const { role, hasMultiple } = useChama();

  const visible = NAV_ITEMS.filter((item) => {
    if (isSuperAdmin) return item.audience === "all";
    if (item.audience === "all") return true;
    if (!hasMembership) return false;
    if (item.audience === "official") return roleIn(role, OFFICIALS);
    return true;
  });

  return (
    <div className="flex flex-col gap-1 p-3">
      {hasMultiple && !isSuperAdmin && (
        <div className="mb-3">
          <ChamaSwitcher label="Current chama" />
        </div>
      )}
      <nav aria-label="Main navigation" className="flex flex-col gap-1">
        {visible.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-primary/12 text-primary" }}
            inactiveProps={{
              className: "text-muted-foreground hover:bg-accent hover:text-foreground",
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <item.icon className="h-4.5 w-4.5" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

NavList.propTypes = { onNavigate: PropTypes.func };

/** Responsive sidebar: static on desktop, slide-over drawer on mobile. */
export function Sidebar({ open, onClose }) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:block">
        <div className="sticky top-16">
          <NavList />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
          <div
            className={cn(
              "relative h-full w-72 border-r border-border bg-sidebar shadow-xl",
              "animate-in slide-in-from-left",
            )}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="text-sm font-semibold text-foreground">Menu</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList onNavigate={onClose} />
          </div>
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = { open: PropTypes.bool, onClose: PropTypes.func.isRequired };

export default Sidebar;
