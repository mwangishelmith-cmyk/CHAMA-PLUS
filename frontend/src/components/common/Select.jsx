import PropTypes from "prop-types";
import { useId } from "react";

import { cn } from "../../lib/utils";

/** Labelled native select — matches the Input component's styling. */
export function Select({ label, error, hint, id, className, options = [], children, ...rest }) {
  const autoId = useId();
  const selectId = id || autoId;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          error ? "border-destructive" : "border-input",
          className,
        )}
        {...rest}
      >
        {children ||
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
      </select>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

Select.propTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  id: PropTypes.string,
  className: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string, label: PropTypes.string }),
  ),
  children: PropTypes.node,
};

export default Select;
