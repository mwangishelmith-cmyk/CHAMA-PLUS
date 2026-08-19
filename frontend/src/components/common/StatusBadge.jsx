import PropTypes from "prop-types";

import { cn } from "../../lib/utils";

/** Maps a domain status to a token-based pill style. */
const STATUS_STYLES = {
  completed: "bg-primary/12 text-primary ring-primary/25",
  active: "bg-primary/12 text-primary ring-primary/25",
  pending: "bg-warning/15 text-warning ring-warning/30",
  failed: "bg-destructive/12 text-destructive ring-destructive/25",
  inactive: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status, children, className }) {
  const key = String(status || "").toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1",
        STATUS_STYLES[key] || STATUS_STYLES.inactive,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children || status}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default StatusBadge;
