/**
 * Unified CandidateTable component.
 *
 * Renders a consistent candidate table across all pages in the hiring platform.
 * Columns: Candidate (name · email · phone), Score, Status, Socials, Applied At, Location, Actions.
 *
 * Front-end filters: name search, status dropdown, location dropdown, applied-at date range.
 * All optional fields (location, applied_at, phone) safely fall back to "N/A".
 */

import type { PaginationState, OnChangeFn } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { useCandidateTableFilters, type CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import { useCandidateTableColumns } from "./CandidateTableColumns";
import { CandidateTableFilters } from "./CandidateTableFilters";
import type { UnifiedCandidate } from "@/types/candidate";
import type { DateRange } from "react-day-picker";

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
  stageOptions?: string[];
  activitySessions?: [number, { start_date: string; end_date: string }][];
  initialDateRange?: DateRange | undefined;
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
  onFiltersChange,
  stageOptions: stageOptionsProp,
  activitySessions,
  initialDateRange,
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
  } = useCandidateTableFilters(candidates, externalNameFilter, onNameFilterChange, showJobContext, isServerSide, onFiltersChange, passing_threshold, stageOptionsProp, activitySessions, initialDateRange);

  const columns = useCandidateTableColumns({
    renderActions,
    passing_threshold,
    showJobContext,
  });

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
        totalCount={total != null && total !== candidates.length ? total : candidates.length}
        minDate={minDate}
        availableJobs={availableJobs}
        hrScoreFilter={hrScoreFilter}
        setHrScoreFilter={setHrScoreFilter}
      />

      <DataTable
        columns={columns}
        data={filteredCandidates}
        headerActions={headerActions}
        isServerSide={isServerSide}
        pageIndex={pagination?.pageIndex}
        pageSize={pagination?.pageSize}
        pageCount={pageCount}
        onPaginationChange={onPaginationChange}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

export default CandidateTable;
