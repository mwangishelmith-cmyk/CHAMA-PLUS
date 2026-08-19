import PropTypes from "prop-types";

import { cn } from "../../lib/utils";
import EmptyState from "./EmptyState";
import LoadingSpinner from "./LoadingSpinner";

/**
 * Column-driven responsive table.
 * columns: [{ key, header, render?(row), className?, srOnlyHeader? }]
 */
export function Table({
  columns,
  rows,
  rowKey = (row, index) => row.id ?? index,
  loading = false,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  caption,
  className,
}) {
  if (loading) return <LoadingSpinner center label="Loading table data" />;
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                  col.className,
                )}
              >
                <span className={col.srOnlyHeader ? "sr-only" : undefined}>{col.header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className="border-b border-border/70 transition-colors last:border-0 hover:bg-accent/60"
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3 text-foreground", col.className)}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Table.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      header: PropTypes.node,
      render: PropTypes.func,
      className: PropTypes.string,
      srOnlyHeader: PropTypes.bool,
    }),
  ).isRequired,
  rows: PropTypes.array.isRequired,
  rowKey: PropTypes.func,
  loading: PropTypes.bool,
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  caption: PropTypes.string,
  className: PropTypes.string,
};

export default Table;
