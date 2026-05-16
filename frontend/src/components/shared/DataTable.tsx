import { useEffect, useRef, useState } from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from "lucide-react";
import { TableRowSkeleton } from "./SkeletonVariants";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  searchKey?: string;
  searchPlaceholder?: string;
  initialSorting?: SortingState;
  // Pagination props for server-side
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;
  onPaginationChange?: OnChangeFn<PaginationState>;
  isServerSide?: boolean;
  headerActions?: React.ReactNode;
  tableActions?: React.ReactNode;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  emptyMessage?: string;
  totalRecords?: number;
  totalCount?: number;
  resultCount?: number;
  entityName?: string;
}


export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  searchKey,
  searchPlaceholder = "Search...",
  initialSorting = [],
  pageIndex = 0,
  pageSize = 10,
  pageCount,
  onPaginationChange,
  isServerSide = false,
  headerActions,
  tableActions,
  onSearchChange,
  searchValue,
  emptyMessage = "No results.",
  totalRecords,
  totalCount,
  resultCount,
  entityName,
}: DataTableProps<TData, TValue>) {

  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [rowSelection, setRowSelection] = useState({});
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex,
    pageSize,
  });

  // Sync internal pagination when props change
  useEffect(() => {
    setInternalPagination({ pageIndex, pageSize });
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [pageIndex, pageSize]);

  const paginationState = isServerSide ? { pageIndex, pageSize } : internalPagination;
  const handlePaginationChange = isServerSide ? onPaginationChange : setInternalPagination;

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Scroll to top of content area on page change
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [paginationState.pageIndex]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    // Add server-side pagination config
    manualPagination: isServerSide,
    pageCount: pageCount,
    onPaginationChange: handlePaginationChange,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection,
      pagination: paginationState,
    },
  });

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {searchKey && (
        <div className="flex w-full items-stretch justify-between gap-1.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 grow items-center gap-3 max-w-full">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue ?? globalFilter ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (onSearchChange) {
                    onSearchChange(value);
                  }
                  table.setGlobalFilter(value);
                }}
                className="h-10 rounded-xl border-border/70 bg-background/90 pl-9 transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {tableActions && (
              <div className="flex items-center gap-2">
                {tableActions}
              </div>
            )}
          </div>
          {(headerActions || totalRecords !== undefined || (totalCount !== undefined && resultCount !== undefined)) && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {headerActions}
              {(totalRecords !== undefined || (totalCount !== undefined && resultCount !== undefined)) && (
                <div className="flex items-center gap-2 ml-auto sm:ml-0">
                  {entityName ? (
                    <div className="text-xs font-medium flex items-center gap-2 justify-self-center px-2">
                      <span className="text-muted-foreground mr-1">Total</span>
                      <span className="font-bold">{totalCount ?? totalRecords}</span> {entityName}
                      {(resultCount !== undefined || searchValue) && (
                        <>
                          <Separator orientation="vertical" className="h-4 bg-gray-700 dark:bg-gray-300" />
                          <span className="font-bold">{resultCount ?? totalRecords}</span> {entityName} found
                        </>
                      )}
                    </div>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary/5 text-primary border-primary/10 hover:bg-primary/10 transition-all flex items-center gap-1.5"
                    >
                      <span className="font-medium">Total:</span>
                      <span className="font-semibold">{(totalRecords ?? resultCount ?? 0).toLocaleString()}</span>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      )}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="px-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              [...Array(pageSize)].map((_, i) => (
                <TableRowSkeleton key={i} columns={columns.length} />
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={loading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="w-fit p-1 h-fit">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground" >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col items-center justify-center gap-3 py-2 sm:flex-row sm:gap-4">
        <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:w-auto sm:gap-5 lg:gap-6">
          <div className="flex items-center space-x-2">
            <p className={cn("text-sm font-medium", !data.length && "text-muted-foreground")}>Rows per page</p>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center gap-2 h-9 w-[75px] justify-between px-3 rounded-xl border border-input bg-background text-sm font-medium cursor-pointer transition-colors hover:bg-muted/50 disabled:opacity-50 "
                )}
                disabled={!data.length}
              >
                {table.getState().pagination.pageSize}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[75px]">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <DropdownMenuItem
                    key={pageSize}
                    onClick={() => table.setPageSize(pageSize)}
                    className={cn(
                      "cursor-pointer justify-center",
                      table.getState().pagination.pageSize === pageSize && "bg-muted font-bold"
                    )}
                  >
                    {pageSize}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className={cn("flex w-[100px] items-center justify-center text-sm font-medium", !data.length && "text-muted-foreground")}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex rounded-lg"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex rounded-lg"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
