/**
 * @module AdminAuditLogs
 * @component AdminAuditLogs
 *
 * Admin page for viewing audit logs.
 * Displays a history of user actions and system events.
 */
import { useState, useEffect } from "react";
import type { AuditLogRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import { DataTable } from "@/components/shared/DataTable";
import { DateDisplay } from "@/components/shared/DateDisplay";
import PageHeader from "@/components/shared/PageHeader";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { ArrowUpDown } from "lucide-react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "@/lib/utils";
import { useAuditLogs } from "@/hooks/queries/admin/useAuditLogs";
import { usePageFilters } from "@/hooks/usePageFilters";

export default function AdminAuditLogs() {
  const { filters, setFilters } = usePageFilters("adminAuditLogs", {
    pageIndex: 0,
    pageSize: 10,
    searchValue: "",
  });
  const { pageIndex, pageSize, searchValue } = filters;

  const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const currentPagination = { pageIndex: filters.pageIndex, pageSize: filters.pageSize };
    const nextPagination = typeof val === "function" ? val(currentPagination) : val;
    setFilters({
      pageIndex: nextPagination.pageIndex,
      pageSize: nextPagination.pageSize,
    });
  };

  const [overallTotal, setOverallTotal] = useState(0);


  const debouncedSearch = useDebouncedValue(searchValue)

  const { data: logs, error, loading, refetch, total } = useAuditLogs(pageIndex * pageSize, pageSize, debouncedSearch)


  useEffect(() => {
    if (!debouncedSearch && total !== overallTotal) {
      queueMicrotask(() => {
        setOverallTotal(total);
      });
    }
  }, [total, debouncedSearch, overallTotal]);


  // Handle search with pagination reset
  const handleSearchChange = (value: string) => {
    setFilters({
      searchValue: value,
      pageIndex: 0,
    });
  };

  const columns: ColumnDef<AuditLogRead>[] = [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Date
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <DateDisplay date={row.original.created_at} />,
    },
    {
      accessorKey: "action",

      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">Action</span>
          </div>
        )
      },
      cell: ({ row }) => {
        const action = toTitleCase(row.original.action);
        return <span>{action}</span>
      },
    },
    {
      accessorKey: "user_name",

      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">User Name</span>
          </div>
        )
      },
      cell: ({ row }) => (
        <span>
          {row.original.user_name}
        </span>
      ),
    },
    /*
    {
      accessorKey: "target_type",
      header: "Target Type",
      cell: ({ row }) => (
        <span className="capitalize text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
          {row.original.target_type || "N/A"}
        </span>
      ),
    },
    {
      accessorKey: "details",
      header: "Details",
      cell: ({ row }) => (
        <div className="max-w-[300px] overflow-hidden">
          <pre className="text-[10px] bg-muted/50 p-2 rounded-lg border overflow-x-auto whitespace-pre-wrap max-h-[100px]">
            {JSON.stringify(row.original.details, null, 2)}
          </pre>
        </div>
      ),
    },
    */
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader title="Audit Logs" />

      {error && !logs.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          loading={loading}
          searchKey="action"
          searchPlaceholder="Filter by action..."
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={setPagination}
          onSearchChange={handleSearchChange}
          searchValue={searchValue}
          isServerSide={true}
          pageCount={Math.ceil(total / pageSize)}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={logs.length}
          entityName="Logs"
        />

      )}
    </AppPageShell>
  );
};
