/**
 * Unified CandidateTable component.
 *
 * Renders a consistent candidate table across all pages in the hiring platform.
 * Columns: Candidate (name · email · phone), Score, Status, Socials, Applied At, Location, Actions.
 *
 * Front-end filters: name search, status dropdown, location dropdown, applied-at date range.
 * All optional fields (location, applied_at, phone) safely fall back to "N/A".
 */

import { useMemo } from "react";
import type { PaginationState, OnChangeFn, ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { useCandidateTableFilters, type CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import { useCandidateTableColumns } from "./CandidateTableColumns";
import { CandidateTableFilters } from "./CandidateTableFilters";
import type { UnifiedCandidate } from "@/types/candidate";
import type { DateRange } from "react-day-picker";
import { Checkbox } from "@/components/ui/checkbox";
import type { Job } from "@/types/job";

export interface CandidateTableProps<T extends UnifiedCandidate> {
  candidates: T[];
  total?: number;
  renderActions?: (candidate: T) => React.ReactNode;
  headerActions?: React.ReactNode;
  isServerSide?: boolean;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  pageCount?: number;
  passing_threshold?: number;
  emptyMessage?: string;
  nameFilter?: string;
  onNameFilterChange?: (value: string) => void;
  showJobContext?: boolean;
  showLocationFilter?: boolean;
  showStatusFilter?: boolean;
  onFiltersChange?: (filters: CandidateActiveFilters) => void;
  stageOptions?: { id: string; name: string }[];
  activitySessions?: [number, { start_date: string; end_date: string }][];
  initialDateRange?: DateRange | undefined;
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: OnChangeFn<Record<string, boolean>>;
  showCheckboxes?: boolean;
  job?: Job | null;
  filters: CandidateActiveFilters;
  setFilters: (filters: Partial<CandidateActiveFilters>) => void;
}

export function CandidateTable<T extends UnifiedCandidate>({
  candidates,
  total,
  renderActions,
  headerActions,
  isServerSide = false,
  pagination,
  onPaginationChange,
  pageCount,
  passing_threshold,
  emptyMessage = "0 applicants found",
  nameFilter: externalNameFilter,
  onNameFilterChange,
  showJobContext = false,
  showLocationFilter = true,
  showStatusFilter = true,
  stageOptions: stageOptionsProp,
  activitySessions,
  filters,
  setFilters,
  rowSelection,
  onRowSelectionChange,
  showCheckboxes = false,
  job
}: CandidateTableProps<T>) {
  const {
    nameFilter,
    setNameFilter,
    statusFilter,
    setStatusFilter,
    locationFilter,
    setLocationFilter,
    hrDecisionFilter,
    setHrDecisionFilter,
    jobFilter,
    setJobFilter,
    dateRange,
    setDateRange,
    statusOptions,
    locationOptions,
    jobOptions,
    locationSearch,
    setLocationSearch,
    jobSearch,
    setJobSearch,
    resultFilter,
    setResultFilter,
    minDate,
    filteredCandidates,
    hasActiveFilters,
    clearFilters,
    availableJobs,
    stageFilter,
    setStageFilter,
    stageOptions,
    hrDecisionOptions,
    resultOptions,
    activitySession,
    setActivitySession,
    activitySearch,
    setActivitySearch,
    hrScoreFilter,
    setHrScoreFilter,
    testEmailSentFilter,
    setTestEmailSentFilter,
    isTestPaperFilterEnabled,
  } = useCandidateTableFilters(
    candidates,
    filters,
    setFilters,
    showJobContext,
    isServerSide,
    passing_threshold,
    stageOptionsProp,
    activitySessions,
    externalNameFilter,
    onNameFilterChange
  );

  const columns = useCandidateTableColumns({
    renderActions,
    passing_threshold,
    showJobContext,
  });

  const columnsWithSelection = useMemo(() => {
    if (!showCheckboxes) return columns;

    const selectColumn: ColumnDef<T> = {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center pl-2.5 pr-1.5">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={!table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center pl-2.5 pr-1.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    };

    return [selectColumn, ...columns];
  }, [columns, showCheckboxes]);
  return (
    <div className="w-full space-y-3">
      <CandidateTableFilters
        nameFilter={nameFilter}
        setNameFilter={setNameFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        jobFilter={jobFilter}
        setJobFilter={setJobFilter}
        showJobContext={showJobContext}
        showLocationFilter={showLocationFilter}
        showStatusFilter={showStatusFilter}
        dateRange={dateRange!}
        setDateRange={setDateRange}
        hrDecisionFilter={hrDecisionFilter}
        setHrDecisionFilter={setHrDecisionFilter}
        statusOptions={statusOptions}
        locationOptions={locationOptions}
        locationSearch={locationSearch}
        setLocationSearch={setLocationSearch}
        jobOptions={jobOptions}
        jobSearch={jobSearch}
        setJobSearch={setJobSearch}
        resultFilter={resultFilter}
        setResultFilter={setResultFilter}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        stageOptions={stageOptions}
        hrDecisionOptions={hrDecisionOptions}
        resultOptions={resultOptions}
        activitySession={activitySession}
        setActivitySession={setActivitySession}
        activitySearch={activitySearch}
        setActivitySearch={setActivitySearch}
        activitySessionOptions={activitySessions}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        resultCount={filteredCandidates.length}
        totalCount={total || candidates.length}
        minDate={minDate}
        availableJobs={availableJobs}
        hrScoreFilter={hrScoreFilter}
        setHrScoreFilter={setHrScoreFilter}
        testEmailSentFilter={testEmailSentFilter}
        setTestEmailSentFilter={setTestEmailSentFilter}
        isTestPaperFilterEnabled={isTestPaperFilterEnabled}
        job={job}
        actions={headerActions}
      />

      <DataTable
        columns={columnsWithSelection}
        data={filteredCandidates}
        headerActions={headerActions}
        isServerSide={isServerSide}
        pageIndex={pagination?.pageIndex}
        pageSize={pagination?.pageSize}
        pageCount={pageCount}
        onPaginationChange={onPaginationChange}
        emptyMessage={emptyMessage}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
      />
    </div>
  );
}

export default CandidateTable;
