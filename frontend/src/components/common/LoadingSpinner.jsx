import PropTypes from "prop-types";

import { cn } from "../../lib/utils";

const SIZES = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-10 w-10 border-[3px]" };

/** Accessible spinner. Pass `label` to describe what is loading. */
export function LoadingSpinner({ size = "md", label = "Loading", className, center = false }) {
  const spinner = (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent align-middle",
        SIZES[size],
        className,
      )}
    />
  );

  if (!center) return spinner;
  return (
    <div className="flex w-full items-center justify-center py-10 text-primary">{spinner}</div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  label: PropTypes.string,
  className: PropTypes.string,
  center: PropTypes.bool,
};

export default LoadingSpinner;
