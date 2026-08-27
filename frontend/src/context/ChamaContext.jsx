import PropTypes from "prop-types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import useAuth from "../hooks/useAuth";

export const ChamaContext = createContext(null);

const STORAGE_KEY = "chama.selectedId";
const isBrowser = typeof window !== "undefined";

/**
 * Current-chama context.
 *
 * A user can belong to several chamas, so every member-scoped request needs an
 * explicit `chama_id` + `member_id`. Those always come from the server-issued
 * membership list — never from user input — which prevents a client-supplied
 * id from leaking another member's data.
 *
 * - 0 memberships -> `membership` is null (onboarding / pending states)
 * - 1 membership  -> auto-selected
 * - 2+            -> the user must pick; the choice is persisted per browser
 */
export function ChamaProvider({ children }) {
  const { memberships, user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);

  // Restore any previous selection once memberships are known.
  useEffect(() => {
    if (!memberships.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      const ids = memberships.map((m) => m.chama_id);
      if (current && ids.includes(current)) return current;
      const stored = isBrowser ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (stored && ids.includes(stored)) return stored;
      return memberships.length === 1 ? memberships[0].chama_id : null;
    });
  }, [memberships]);

  const selectChama = useCallback((chamaId) => {
    setSelectedId(chamaId);
    if (isBrowser && chamaId) window.localStorage.setItem(STORAGE_KEY, chamaId);
  }, []);

  // Clear the stored selection when the session ends.
  useEffect(() => {
    if (!user && isBrowser) window.localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const membership = useMemo(
    () => memberships.find((m) => m.chama_id === selectedId) || null,
    [memberships, selectedId],
  );

  const value = useMemo(
    () => ({
      memberships,
      membership,
      chamaId: membership?.chama_id ?? null,
      memberId: membership?.member_id ?? null,
      role: membership?.role ?? null,
      selectChama,
      needsSelection: memberships.length > 1 && !membership,
      hasMultiple: memberships.length > 1,
    }),
    [memberships, membership, selectChama],
  );

  return <ChamaContext.Provider value={value}>{children}</ChamaContext.Provider>;
}

ChamaProvider.propTypes = { children: PropTypes.node };

/** Access the current chama context. Must be used inside <ChamaProvider />. */
export function useChama() {
  const ctx = useContext(ChamaContext);
  if (!ctx) throw new Error("useChama must be used within a ChamaProvider");
  return ctx;
}

export default ChamaProvider;
