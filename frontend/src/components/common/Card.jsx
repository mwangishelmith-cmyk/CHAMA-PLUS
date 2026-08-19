import PropTypes from "prop-types";

import { cn } from "../../lib/utils";

/** Surface container with optional header/footer slots. */
export function Card({ children, className, as: Tag = "div", ...rest }) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

Card.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.elementType,
};

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border p-5", className)}>
      <div>
        {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

CardHeader.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  action: PropTypes.node,
  className: PropTypes.string,
};

export function CardBody({ children, className }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

CardBody.propTypes = { children: PropTypes.node, className: PropTypes.string };

export function CardFooter({ children, className }) {
  return <div className={cn("border-t border-border p-5", className)}>{children}</div>;
}

CardFooter.propTypes = { children: PropTypes.node, className: PropTypes.string };

export default Card;
