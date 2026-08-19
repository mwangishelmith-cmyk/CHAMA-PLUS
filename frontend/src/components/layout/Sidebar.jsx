import PropTypes from "prop-types";
import { Link } from "@tanstack/react-router";
import { CreditCard, LayoutDashboard, Settings, Users, Wallet, X } from "lucide-react";

import { cn } from "../../lib/utils";

/** Primary navigation items. Add routes here as pages are built. */
export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  // `to: null` = planned section; rendered disabled until the route exists.
  { to: null, label: "Chamas", icon: Users },
  { to: null, label: "Ledger", icon: Wallet },
  { to: null, label: "Contributions", icon: CreditCard },
  { to: null, label: "Settings", icon: Settings },
];

function NavList({ onNavigate }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) =>
        item.to ? (
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
        ) : (
          <span
            key={item.label}
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/60"
          >
            <item.icon className="h-4.5 w-4.5" aria-hidden="true" />
            {item.label}
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">
              Soon
            </span>
          </span>
        ),
      )}
    </nav>
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
