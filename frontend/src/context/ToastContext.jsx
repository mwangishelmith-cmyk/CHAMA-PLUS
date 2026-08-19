import PropTypes from "prop-types";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { ToastViewport } from "../components/common/Toast";

const ToastContext = createContext(null);

/**
 * Minimal notification system: `toast.success(msg)` / `.error()` / `.info()`.
 * Toasts auto-dismiss and are announced via an aria-live region.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant, message, { title, duration = 4500 } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [...current, { id, variant, message, title }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (message, opts) => push("success", message, opts),
      error: (message, opts) => push("error", message, opts),
      info: (message, opts) => push("info", message, opts),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = { children: PropTypes.node };

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
