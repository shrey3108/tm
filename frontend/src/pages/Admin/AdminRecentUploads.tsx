/**
 * @module AdminRecentUploads
 * @component AdminRecentUploads
 *
 * Admin page for viewing recent file uploads.
 * Displays a list of recently uploaded resumes and documents.
 */

import { useState, useEffect } from "react";
import type { RecentUploadRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import { DataTable } from "@/components/shared/DataTable";
import { DateDisplay } from "@/components/shared/DateDisplay";
import PageHeader from "@/components/shared/PageHeader";
import ErrorDisplay from "@/components/shared/ErrorDisplay";

import { ArrowUpDown } from "lucide-react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { formatFileSize, type FileSizeUnit } from "@/utils/converters";
import { useRecentUploads } from "@/hooks/queries/admin/useRecentUpload";
import { capitalize, cn } from "@/lib/utils";
import { usePageFilters } from "@/hooks/usePageFilters";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useDebouncedValue } from "@/hooks/useDebounced";



export default function AdminRecentUploads() {
  const { filters, setFilters, setFilter } = usePageFilters("adminRecentUploads", {
    pageIndex: 0,
    pageSize: 10,
    searchValue: "",
    fileSizeUnit: "Auto" as FileSizeUnit,
  });
  const { pageIndex, pageSize, searchValue, fileSizeUnit } = filters;

  const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const currentPagination = { pageIndex: filters.pageIndex, pageSize: filters.pageSize };
    const nextPagination = typeof val === "function" ? val(currentPagination) : val;
    setFilters({
      pageIndex: nextPagination.pageIndex,
      pageSize: nextPagination.pageSize,
    });
  };

  const setFileSizeUnit = (unit: FileSizeUnit) => setFilter("fileSizeUnit", unit);

  const [overallTotal, setOverallTotal] = useState(0);

  const debouncedSearch = useDebouncedValue(searchValue)

  const { data: uploads, error, loading, refetch, total } = useRecentUploads(pageIndex * pageSize, pageSize, debouncedSearch)

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



  const columns: ColumnDef<RecentUploadRead>[] = [
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
      accessorKey: "file_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          File Name
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-wrap">{row.original.file_name || "N/A"}</span>
      ),
    },
    // {
    //   accessorKey: "file_type",
    //   header: "Type",
    //   cell: ({ row }) => (
    //     <span className="uppercase  font-bold text-muted-foreground">
    //       {row.original.file_type || "N/A"}
    //     </span>
    //   ),
    // },
    {
      accessorKey: "size",

      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">Size</span>
          </div>
        )
      },
      cell: ({ row }) =>
        row.original.size ? formatFileSize(row.original.size, fileSizeUnit) : "N/A",
    },
    {
      accessorKey: "uploader_name",

      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">Uploaded By</span>
          </div>
        )
      },
      cell: ({ row }) => (
        <span
          className=""
        >
          {capitalize(row.original.uploader_name || "N/A")}
        </span>
      ),
    },
    {
      accessorKey: "candidate_name",

      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">Candidate Name</span>
          </div>
        )
      },
      cell: ({ row }) => (
        <span
          className=""
        >
          {capitalize((row.original.candidate_name)?.toLowerCase() || "N/A")}
        </span>
      ),
    },

  ];

  return (
    <AppPageShell width="wide">
      <PageHeader title="Recent Uploads" />
      {error && !uploads?.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={uploads}
          loading={loading}
          searchKey="file_name"
          searchPlaceholder="Filter by file name..."
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={setPagination}
          onSearchChange={handleSearchChange}
          searchValue={searchValue}
          isServerSide={true}
          pageCount={Math.ceil(total / pageSize)}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={uploads.length}
          entityName="Uploads"
          tableActions={

            <div className="flex items-center gap-2">
              <span className="font-medium">Unit:</span>

              <SearchableSelect
                value={fileSizeUnit}
                onValueChange={(value) => setFileSizeUnit(value as FileSizeUnit)}
                options={[{ id: "Auto", label: "Auto" }, { id: "KB", label: "KB" }, { id: "MB", label: "MB" }]}
                placeholder="Departments"
                pluralLabel="Departments"
                clearLabel="Clear Selection"
                triggerClassName={cn(
                  "w-fit inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
                )}
                contentClassName="min-w-50"
              />
            </div>
          }
        />
      )}
    </AppPageShell>
  );
};
