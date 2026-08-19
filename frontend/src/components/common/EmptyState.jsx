import PropTypes from "prop-types";
import { Inbox } from "lucide-react";

import { cn } from "../../lib/utils";

/** Shown when a collection has no rows (or a search returns nothing). */
export function EmptyState({ title, description, action, icon, className }) {
  const Icon = icon || Inbox;
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  action: PropTypes.node,
  icon: PropTypes.elementType,
  className: PropTypes.string,
};

export default EmptyState;
