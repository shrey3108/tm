/**
 * Reusable data table component for admin interfaces.
 * Displays tabular data with loading, error, and empty states.
 */

import React, { type ReactNode } from "react";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import Pagination from "@/components/shared/Pagination";
import { cn } from "@/lib/utils";

import { TableRowSkeleton } from "@/components/shared/SkeletonVariants";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Column definition for AdminDataTable.
 * @typeParam T - The data type being displayed
 */
export interface Column<T> {
  /** Column header text */
  header: string;
  /** Property name or function to get cell value */
  accessor: keyof T | ((item: T) => ReactNode);
  /** Optional CSS class for the column cells */
  className?: string;
  /** Optional inline styles for the column */
  style?: React.CSSProperties;
  /** Optional width for the column (e.g., '30%', '100px') */
  width?: string;
  /** Optional overflow behavior */
  overflow?: 'ellipsis' | 'wrap';
}

/**
 * Props for the AdminDataTable component.
 * @typeParam T - The data type being displayed in the table
 */
interface AdminDataTableProps<T> {
  /** Column definitions for the table */
  columns: Column<T>[];
  /** Data items to display */
  data: T[];
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error message to display if fetch failed */
  error?: string | null;
  /** Callback to retry failed data fetch */
  onRetry?: () => void;
  /** Message to display when no data is available */
  emptyMessage?: string;
  /** Property name or function to get unique row key */
  rowKey: keyof T | ((item: T) => string | number);
  /** Additional CSS class for the card wrapper */
  className?: string;
  /** Additional CSS class for the table element */
  tableClassName?: string;
  /** Current page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Total number of items (for pagination) */
  total?: number;
  /** Callback when page is changed */
  onPageChange?: (page: number) => void;
}

/**
 * Admin data table with sorting, loading, error, and empty states.
 * Updated to use standard shadcn/ui Table components.
 */
function AdminDataTable<T>({
  columns,
  data,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = "No items found.",
  rowKey,
  className = "",
  page,
  pageSize = 10,
  total,
  onPageChange,
}: AdminDataTableProps<T>) {
  // If error and no data, show full ErrorDisplay
  if (error && data.length === 0) {
    return <ErrorDisplay message={error} onRetry={onRetry} />;
  }

  const getRowKey = (item: T): string | number => {
    if (typeof rowKey === "function") {
      return rowKey(item);
    }
    return item[rowKey] as unknown as string | number;
  };

  return (
    <Card className={`${className}`}>
      <CardContent className="pt-0 px-0">
        {/* If error and data exists, show a smaller alert above the table */}
        {error && data.length > 0 && (
          <div className="mb-3 px-6 pt-6">
            <ErrorDisplay message={error} onRetry={onRetry} />
          </div>
        )}

        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  className={column.className}
                  style={column.width ? { width: column.width, ...column.style } : column.style}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Use skeletons if loading
              [...Array(pageSize)].map((_, i) => (
                <TableRowSkeleton key={i} columns={columns.length} />
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="py-4 text-muted">
                    <h5 className="fw-bold">{emptyMessage}</h5>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={getRowKey(item)}>
                  {columns.map((column, index) => {
                    const overflow = column.overflow ?? 'ellipsis';
                    return (
                      <TableCell
                        key={index}
                        className={cn(
                          column.className,
                          overflow === 'ellipsis' && "overflow-hidden text-ellipsis whitespace-nowrap",
                          overflow === 'wrap' && "whitespace-normal wrap-break-word",
                        )}
                        style={column.style}
                      >
                        {typeof column.accessor === "function"
                          ? column.accessor(item)
                          : (item[column.accessor] as ReactNode)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {total !== undefined && onPageChange && (
          <div className="px-6 py-4 border-t">
            <Pagination
              page={page || 1}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              dataLength={data.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminDataTable;
