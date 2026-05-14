import { useState, useMemo, useCallback } from "react";
import type { HiringReport, JobPipelineStats } from "@/types/admin";
import type { JobTitle } from "@/types/job";

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
 * Builds a lookup map from an array of items with title and id properties.
 * @param items - Array of objects containing title and id properties
 * @returns A record mapping titles to their corresponding IDs
 */
const buildLookupMap = (items: { title: string; id: string }[]): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const item of items) map[item.title] = item.id;
  return map;
};


/**
 * Builds a mapping from job titles to their departments based on candidate data.
 * @param candidates - Array of candidates with job_title and department properties
 * @returns A record mapping job titles to department names
 */
const buildDeptMap = (candidates: HiringReport["candidates_by_job"]): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const item of candidates) {
    if (item.job_title && item.department) {
      map[item.job_title] = item.department;
    }
  }
  return map;
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

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Lookup maps
  const jobTitleToId = useMemo(() => buildLookupMap(jobs), [jobs]);
  const jobIdToTitle = useMemo(() => {
    const map: Record<string, string> = {};
    jobs.forEach(j => map[j.id] = j.title);
    return map;
  }, [jobs]);

  const jobToDept = useMemo(
    () => (report ? buildDeptMap(report.candidates_by_job) : {}),
    [report]
  );

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

    return Array.from(depts).sort();
  }, [report, filters.jobIds, jobIdToTitle, allDepartments]);

  // Filter stages based on selected jobs and departments
  const filteredStages = useMemo(() => {
    if (!report) return stages;

    // If no job or department filters, show all stages that have data
    // Or just all stages from the template? 
    // Usually we want to show stages that are relevant to the selection.
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

    // If activeStages is empty (e.g. no data for selection), we might want to show all or none.
    // Showing none might be better for "dynamic" feel.
    return stages.filter(s => activeStages.has(s.name));
  }, [report, filters.jobIds, filters.departments, jobIdToTitle, stages]);

  // Derived: filtered report
  const filteredReport = useMemo(() => {
    if (!report) return null;

    // No filters selected return original report
    const hasFilters = Object.values(filters).some((arr) => arr.length > 0);
    if (!hasFilters) return report;

    // Filter pipeline stats
    // Find the item that contains the full list of job names
    const allJobNames = report.job_pipeline_stats.find((item) => item.job_names)?.job_names || [];

    const filteredJobNames = allJobNames.filter((jobName) => {
      const dept = jobToDept[jobName];
      const id = jobTitleToId[jobName];
      return (
        (filters.departments.length === 0 || (dept && filters.departments.includes(dept))) &&
        (filters.jobIds.length === 0 || (id && filters.jobIds.includes(id)))
      );
    });

    const jobPipelineStats = report.job_pipeline_stats
      .map((item): PipelineStatsItem | null => {
        // If filtering by stage, only keep the selected stages
        if (filters.stages.length > 0 && item.stage && !filters.stages.includes(item.stage)) {
          return null;
        }

        const newItem: PipelineStatsItem = { ...item };

        // If it's a data point (has stage), remove non-filtered jobs
        const filteredJobNameSet = new Set(filteredJobNames);
        if (item.stage) {
          allJobNames.forEach(name => {
            if (!filteredJobNameSet.has(name)) {
              delete newItem[name];
            }
          });
          // Only keep the stage if at least one filtered job has candidates
          // Showing data with 0 values is useless
          return filteredJobNames.some(name => (newItem[name] ?? 0) > 0) ? newItem : null;
        }

        // If it's the names holder (has job_names), update it
        if (item.job_names) {
          newItem.job_names = filteredJobNames;
          return filteredJobNames.length > 0 ? newItem : null;
        }

        return newItem;
      })
      .filter((item): item is PipelineStatsItem => item !== null);

    return {
      ...report,
      job_pipeline_stats: jobPipelineStats,
    };
  }, [report, filters, jobToDept, jobTitleToId]);

  /** Whether any filters are currently active */
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
      setFilters((prev) => {
        const arr = prev[key];
        const newArr = arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value];

        // Clear jobIds when departments change
        const resetJobs = key === "departments" ? { jobIds: [] as string[] } : {};
        return { ...prev, [key]: newArr, ...resetJobs };
      });
    },
    []
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
      setFilters((prev) => ({
        ...prev,
        [key]: values,
        // Clear jobIds ONLY if we are explicitly changing departments to something else
        ...(key === "departments" ? { jobIds: [] as string[] } : {}),
      }));
    },
    []
  );

  /**
   * Clears all values for a specific filter.
   * When departments are cleared, jobIds are also cleared.
   * @param key - The filter key to clear
   */
  const clearFilter = useCallback(
    <K extends keyof FilterState>(key: K) => {
      setFilters((prev) => ({
        ...prev,
        [key]: [] as FilterState[K],
        ...(key === "departments" ? { jobIds: [] as string[] } : {}),
      }));
    },
    []
  );

  /** Resets all filters to their initial state */
  const resetFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);

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