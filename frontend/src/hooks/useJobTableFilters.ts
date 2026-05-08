import { useMemo, useState } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { Job } from "@/types/job";
import type { DepartmentRead } from "@/types/admin";

export const useJobTableFilters = (jobs: Job[]) => {
  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });
  const [departmentSearch, setDepartmentSearch] = useState("");

  const minDate = useMemo(() => {
    if (jobs.length === 0) return new Date();
    const dates = jobs.map((job) => new Date(job.created_at).getTime());
    return new Date(Math.min(...dates));
  }, [jobs]);

  const departmentOptions = useMemo(() => {
    const uniqueDeptsMap = new Map<string, DepartmentRead>();
    jobs.forEach((job) => {
      if (job.department) {
        const trimmedName = job.department.name.trim();
        if (!uniqueDeptsMap.has(trimmedName)) {
          uniqueDeptsMap.set(trimmedName, {
            id: job.department.id,
            name: trimmedName,
            description: job.department.description,
          } as DepartmentRead);
        }
      } else if (job.department_id && job.department_name) {
        const trimmedName = job.department_name.trim();
        if (!uniqueDeptsMap.has(trimmedName)) {
          uniqueDeptsMap.set(trimmedName, {
            id: job.department_id,
            name: trimmedName,
          } as DepartmentRead);
        }
      }
    });

    let opts = Array.from(uniqueDeptsMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    if (departmentSearch) {
      opts = opts.filter(d => d.name.toLowerCase().includes(departmentSearch.toLowerCase()));
    }

    return opts;
  }, [jobs, departmentSearch]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      // Title, status, and department search are handled server-side.

      // Date range filter (created_at)
      if (j.created_at && (dateRange?.from || dateRange?.to)) {
        const d = new Date(j.created_at);
        if (dateRange.from && d < startOfDay(dateRange.from)) return false;
        if (dateRange.to && d > endOfDay(dateRange.to)) return false;
      }

      return true;
    });
  }, [jobs, dateRange]);

  const hasActiveFilters =
    !!titleFilter ||
    statusFilter.length > 0 ||
    departmentFilter.length > 0 ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const clearFilters = () => {
    setTitleFilter("");
    setStatusFilter([]);
    setDepartmentFilter([]);
    setDateRange({ from: undefined, to: undefined });
  };

  return {
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    dateRange,
    setDateRange,
    departmentOptions,
    departmentSearch,
    setDepartmentSearch,
    filteredJobs,
    hasActiveFilters,
    clearFilters,
    minDate
  };
};
