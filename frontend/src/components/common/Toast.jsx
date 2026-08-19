import PropTypes from "prop-types";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "../../lib/utils";

const VARIANTS = {
  success: { icon: CheckCircle2, accent: "text-primary", ring: "ring-primary/30" },
  error: { icon: AlertTriangle, accent: "text-destructive", ring: "ring-destructive/30" },
  info: { icon: Info, accent: "text-muted-foreground", ring: "ring-border" },
};

/** A single toast. Rendered by <ToastViewport />, driven by ToastContext. */
export function Toast({ toast, onDismiss }) {
  const { icon: Icon, accent, ring } = VARIANTS[toast.variant] || VARIANTS.info;
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-lg ring-1",
        "animate-in slide-in-from-bottom-2 fade-in",
        ring,
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", accent)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold text-foreground">{toast.title}</p>}
        <p className="text-sm text-muted-foreground break-words">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

Toast.propTypes = {
  toast: PropTypes.shape({
    id: PropTypes.string.isRequired,
    variant: PropTypes.oneOf(["success", "error", "info"]),
    title: PropTypes.string,
    message: PropTypes.node,
  }).isRequired,
  onDismiss: PropTypes.func.isRequired,
};

/** Fixed, screen-reader-announced stack of toasts. */
export function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:w-96 sm:items-end"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

ToastViewport.propTypes = {
  toasts: PropTypes.array.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

export default Toast;
