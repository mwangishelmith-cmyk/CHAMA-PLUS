import PropTypes from "prop-types";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu, ShieldCheck, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import useAuth from "../../hooks/useAuth";
import { useChama } from "../../context/ChamaContext";
import { useToast } from "../../context/ToastContext";
import { roleLabel } from "../../lib/roles";
import ThemeToggle from "./ThemeToggle";

/** Sticky app header with the brand, mobile menu trigger and user menu. */
export function Header({ onMenuClick }) {
  const { user, logout, isSuperAdmin } = useAuth();
  const { role, membership } = useChama();
  const toast = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the user menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success("You have been signed out.");
    navigate({ to: "/login", replace: true });
  };

  const initials = (user?.full_name || "U")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="grid h-10 w-10 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent lg:hidden"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">ChamaLedger</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initials}
              </span>
              <span className="hidden max-w-[10rem] truncate text-sm font-medium text-foreground sm:inline">
                {user?.full_name}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-semibold">{user?.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  {/* Current role — makes RBAC behaviour visible to the user. */}
                  <span className="mt-2 inline-flex items-center rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {isSuperAdmin
                      ? "Platform admin"
                      : membership
                        ? `${roleLabel(role)} · ${membership.chama_name || "Chama"}`
                        : "No chama yet"}
                  </span>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="h-4 w-4" aria-hidden="true" /> Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

Header.propTypes = { onMenuClick: PropTypes.func.isRequired };

export default Header;
