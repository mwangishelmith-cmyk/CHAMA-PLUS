import PropTypes from "prop-types";
import { useId } from "react";

import { cn } from "../../lib/utils";

/** Labelled input with error/hint text wired up for screen readers. */
export function Input({
  label,
  error,
  hint,
  id,
  className,
  type = "text",
  leadingIcon = null,
  trailingSlot = null,
  ...rest
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground",
            "placeholder:text-muted-foreground transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-60",
            leadingIcon && "pl-10",
            trailingSlot && "pr-11",
            error ? "border-destructive" : "border-input",
            className,
          )}
          {...rest}
        />
        {trailingSlot && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailingSlot}</span>
        )}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

Input.propTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  id: PropTypes.string,
  className: PropTypes.string,
  type: PropTypes.string,
  leadingIcon: PropTypes.node,
  trailingSlot: PropTypes.node,
};

export default Input;
