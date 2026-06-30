import { useMemo, useCallback } from "react";
import type { HiringReport } from "@/types/admin";
import type { JobPipelineStats } from "@/types/job";
import type { JobTitle } from "@/types/job";
import { usePageFilters } from "@/hooks/usePageFilters";

/**
 * State shape for admin dashboard filters.
 */
export interface FilterState {
  jobIds: string[];
  stages: string[];
  departments: string[];
}

type PipelineStatsItem = JobPipelineStats & Record<string, number | undefined>;

const INITIAL_FILTERS: FilterState = {
  jobIds: [],
  stages: [],
  departments: [],
};


/**
 * Extracts unique department names from candidate data and returns them sorted alphabetically.
 * @param candidates - Array of candidates with department property
 * @returns A sorted array of unique department names
 */
const extractDepartments = (candidates: HiringReport["candidates_by_job"]): string[] => {
  const deps = new Set<string>();
  for (const item of candidates) {
    if (item.department) deps.add(item.department);
  }
  return Array.from(deps).sort();
};

/**
 * Custom hook for managing admin dashboard filters including jobs, stages, and departments.
 * Provides filtered jobs, filtered report data, and filter actions.
 * @param report - The hiring report data containing candidates and pipeline stats
 * @param jobs - Array of available job titles
 * @returns Object containing filters, filtered data, and filter manipulation functions
 */
export const useAdminDashboardFilters = (
  report: HiringReport | undefined,
  jobs: JobTitle[],
  stages: { name: string }[]
) => {

  const { filters, setFilters: reduxSetFilters, resetFilters: reduxResetFilters } = usePageFilters("adminDashboard", INITIAL_FILTERS);

  // Lookup maps
  const jobIdToTitle = useMemo(() => {
    const map: Record<string, string> = {};
    jobs.forEach(j => map[j.id] = j.title);
    return map;
  }, [jobs]);

  // All unique departments from report
  const allDepartments = useMemo(
    () => (report ? extractDepartments(report.candidates_by_job) : []),
    [report]
  );

  // Jobs with candidate counts merged from report
  const jobsWithCounts = useMemo(() => {
    if (!report) return jobs.map(j => ({ ...j, candidate_count: 0 }));

    const countMap = new Map(report.candidates_by_job.map(c => [c.job_id, c.candidate_count]));
    return jobs.map(j => ({
      ...j,
      candidate_count: countMap.get(j.id) || 0
    }));
  }, [jobs, report]);

  // When departments are selected show only those jobs
  const filteredJobs = useMemo(() => {
    // no department filter selected show all jobs
    if (!report || filters.departments.length === 0) return jobsWithCounts;

    // Set is used for quick lookup in O(1)
    const deptSet = new Set(filters.departments);
    // Get all Job names for the selected departments
    const validTitles = new Set(
      report.candidates_by_job
        .filter((c) => c.job_title && c.department && deptSet.has(c.department))
        .map((c) => c.job_title)
    );

    // Filter jobs based on the valid job names
    return jobsWithCounts.filter((j) => validTitles.has(j.title));
  }, [jobsWithCounts, filters.departments, report]);

  // Filter departments based on selected jobs
  const filteredDepartments = useMemo(() => {
    if (!report || filters.jobIds.length === 0) return allDepartments;

    const selectedJobTitles = new Set(
      filters.jobIds
        .map(id => jobIdToTitle[id])
        .filter((title): title is string => !!title)
    );
    const depts = new Set<string>();

    report.candidates_by_job.forEach(c => {
      if (c.job_title && selectedJobTitles.has(c.job_title) && c.department) {
        depts.add(c.department);
      }
    });

    // Ensure selected departments are preserved
    filters.departments.forEach(d => depts.add(d));

    return Array.from(depts).sort();
  }, [report, filters.jobIds, filters.departments, jobIdToTitle, allDepartments]);

  // Filter stages based on selected jobs and departments
  const filteredStages = useMemo(() => {
    if (!report) return stages;

    if (filters.jobIds.length === 0 && filters.departments.length === 0) return stages;

    let targetJobTitles: Set<string>;
    if (filters.jobIds.length > 0) {
      targetJobTitles = new Set(
        filters.jobIds
          .map(id => jobIdToTitle[id])
          .filter((title): title is string => !!title)
      );
    } else {
      const deptSet = new Set(filters.departments);
      targetJobTitles = new Set(
        report.candidates_by_job
          .filter(c => c.department && deptSet.has(c.department) && c.job_title)
          .map(c => c.job_title!)
      );
    }

    const activeStages = new Set<string>();
    report.job_pipeline_stats.forEach(item => {
      if (item.stage) {
        const hasData = Array.from(targetJobTitles).some(title => (item[title] ?? 0) > 0);
        if (hasData) activeStages.add(item.stage);
      }
    });

    // Ensure selected stages are preserved
    filters.stages.forEach(s => activeStages.add(s));

    return stages.filter(s => activeStages.has(s.name));
  }, [report, filters.jobIds, filters.departments, filters.stages, stages, jobIdToTitle]);


  // Helper: Filter pipeline stats for a given stage
  const filterPipelineStats = (
    item: PipelineStatsItem,
    selectedJobTitles: Set<string> | null
  ) => {
    const { stage, total_candidates, ...jobCounts } = item;
    const filteredCounts: Record<string, number> = {};

    let total = 0;
    Object.entries(jobCounts).forEach(([jobTitle, count]) => {
      if (typeof count === "number" && (!selectedJobTitles || selectedJobTitles.has(jobTitle))) {
        filteredCounts[jobTitle] = count;
        total += count;
      }
    });

    return {
      stage,
      total_candidates: total,
      ...filteredCounts
    } as PipelineStatsItem;
  };

  // Filter report data based on current selections
  const filteredReport = useMemo(() => {
    if (!report) return undefined;

    const { jobIds, stages: selectedStages, departments: selectedDepts } = filters;

    // 1. Determine active job titles based on selections
    let activeJobTitles: Set<string> | null = null;
    if (jobIds.length > 0) {
      activeJobTitles = new Set(
        jobIds.map(id => jobIdToTitle[id]).filter((title): title is string => !!title)
      );
    } else if (selectedDepts.length > 0) {
      const deptSet = new Set(selectedDepts);
      activeJobTitles = new Set(
        report.candidates_by_job
          .filter(c => c.department && deptSet.has(c.department) && c.job_title)
          .map(c => c.job_title!)
      );
    }

    // 2. Filter candidates by job (row-level data)
    let candidates = report.candidates_by_job;
    if (activeJobTitles) {
      candidates = candidates.filter(c => c.job_title && activeJobTitles!.has(c.job_title));
    }

    // 3. Filter pipeline stats (column-level/stage-level aggregations)
    const originalPipeline = report.job_pipeline_stats || [];
    const stageItems = originalPipeline.filter(item => item.stage) as PipelineStatsItem[];
    const metadataItem = originalPipeline.find(item => !item.stage && item.job_names);
    const originalJobNames = metadataItem ? (metadataItem.job_names || []) : [];

    let pipeline = stageItems;
    if (selectedStages.length > 0) {
      const stageSet = new Set(selectedStages);
      pipeline = pipeline.filter(item => item.stage && stageSet.has(item.stage));
    }

    // Apply job-specific column filters to pipeline stats
    if (activeJobTitles) {
      pipeline = pipeline.map(item => filterPipelineStats(item, activeJobTitles));
    }

    const filteredJobNames = activeJobTitles
      ? originalJobNames.filter(name => activeJobTitles!.has(name))
      : originalJobNames;

    const finalPipeline = [
      ...pipeline,
      { job_names: filteredJobNames }
    ];

    return {
      ...report,
      candidates_by_job: candidates,
      job_pipeline_stats: finalPipeline as JobPipelineStats[]
    } as HiringReport;
  }, [report, filters, jobIdToTitle]);

  const hasActiveFilters =
    useMemo(
      () => Object.values(filters).some((arr) => arr.length > 0), [filters]
    )

  /**
   * Toggles a filter value on/off. If the value exists in the filter array, it's removed; otherwise, it's added.
   * When departments are changed, jobIds are automatically cleared.
   * @param key - The filter key to modify
   * @param value - The value to toggle
   */
  const toggleFilter = useCallback(
    <K extends keyof FilterState>(
      key: K,
      value: FilterState[K][number]
    ) => {
      const arr = filters[key];
      const newArr = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];

      // Clear jobIds when departments change
      const resetJobs = key === "departments" ? { jobIds: [] as string[] } : {};
      reduxSetFilters({ [key]: newArr, ...resetJobs });
    },
    [filters, reduxSetFilters]
  );

  /**
   * Sets filter values, replacing existing values.
   * When departments are changed, jobIds are automatically cleared.
   * @param key - The filter key to modify
   * @param values - The new values for the filter
   */
  const setFilter = useCallback(
    <K extends keyof FilterState>(
      key: K,
      values: FilterState[K]
    ) => {
      reduxSetFilters({
        [key]: values,
        ...(key === "departments" ? { jobIds: [] as string[] } : {}),
      });
    },
    [reduxSetFilters]
  );

  /**
   * Clears all values for a specific filter.
   * When departments are cleared, jobIds are also cleared.
   * @param key - The filter key to clear
   */
  const clearFilter = useCallback(
    <K extends keyof FilterState>(key: K) => {
      reduxSetFilters({
        [key]: [] as FilterState[K],
        ...(key === "departments" ? { jobIds: [] as string[] } : {}),
      });
    },
    [reduxSetFilters]
  );

  /** Resets all filters to their initial state */
  const resetFilters = useCallback(() => reduxResetFilters(), [reduxResetFilters]);

  return {
    filters,
    departments: filteredDepartments,
    stages: filteredStages,
    filteredJobs,
    filteredReport,
    hasActiveFilters,
    resetFilters,
    toggleFilter,
    setFilter,
    clearFilter,
  };
};
