import { useEffect, useMemo, useState } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { UnifiedCandidate } from "@/types/candidate";
import { toTitleCase } from "@/lib/utils";
import { adminLocationService } from "@/apis/admin/location";
import jobService from "@/apis/job";
import { slugify } from "@/utils/slug";

export interface CandidateActiveFilters {
  status: string[];
  city: string[];
  job: string[];
  hr_decision: string[];
  dateRange?: { from?: Date; to?: Date };
  resumeScreening?: string[];
}

export const useCandidateTableFilters = <T extends UnifiedCandidate>(
  candidates: T[],
  externalNameFilter?: string,
  onNameFilterChange?: (val: string) => void,
  /** Pass false on pages where the job-title filter column is not shown (e.g. per-job
   *  candidates view) to skip the getJobTitles() network request entirely. */
  fetchJobTitles = true,
  isServerSide = false,
  onFiltersChange?: (filters: CandidateActiveFilters) => void,
  passingThreshold = 65,
  jobId?: string
) => {
  const [internalNameFilter, setInternalNameFilter] = useState("");

  const nameFilter = externalNameFilter !== undefined ? externalNameFilter : internalNameFilter;
  const setNameFilter = onNameFilterChange !== undefined ? onNameFilterChange : setInternalNameFilter;

  // Debounced name filter for URL syncing and filtering
  const [debouncedNameFilter, setDebouncedNameFilter] = useState(nameFilter);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNameFilter(nameFilter);
    }, 500);
    return () => clearTimeout(handler);
  }, [nameFilter]);

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [hrDecisionFilter, setHrDecisionFilter] = useState<string[]>([]);

  // jobFilter stores IDs internally for filtering and API calls, but we sync slugs to URL
  const [jobFilter, setJobFilter] = useState<string[]>([]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [availableJobs, setAvailableJobs] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [resumeScreeningFilter, setResumeScreeningFilter] = useState<string[]>([]);

  // Memoized job options filtered by search query
  const jobOptions = useMemo(() => {
    if (!jobSearch.trim()) return availableJobs;
    const query = jobSearch.toLowerCase();
    return availableJobs.filter(j =>
      j.title.toLowerCase().includes(query)
    );
  }, [availableJobs, jobSearch]);

  // Fetch all job titles once on mount — only when the job-filter column is visible.
  useEffect(() => {
    if (!fetchJobTitles) return;
    const fetchJobs = async () => {
      try {
        const response = await jobService.getJobTitles();
        const jobsArray = Array.isArray(response) ? response : (response as any)?.data;


        const jobs = jobsArray.map((j: any) => ({
          id: j.id,
          title: j.title?.trim() || "Untitled",
          slug: slugify(j.title || "")
        }));
        setAvailableJobs(jobs);
      } catch (error) {
        console.error("Failed to fetch jobs for filter:", error);
      }
    };
    fetchJobs();
  }, [fetchJobTitles]); // Fetch whenever job context becomes active

  // Call onFiltersChange when internal filter states update
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        status: statusFilter,
        city: locationFilter,
        job: jobFilter,
        hr_decision: hrDecisionFilter,
        dateRange: dateRange,
        resumeScreening: resumeScreeningFilter
      });
    }
  }, [statusFilter, locationFilter, jobFilter, hrDecisionFilter, dateRange, resumeScreeningFilter, onFiltersChange]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const fetchLocations = async () => {
        try {
          const response = await adminLocationService.getAllLocations(0, 500, locationSearch, jobId);
          const names = response.data.map((loc) => toTitleCase(loc.name.trim()));
          // Ensure unique and sorted names
          const uniqueNames = Array.from(new Set(names)).sort();
          setLocationOptions(uniqueNames);
        } catch (error) {
          console.error("Failed to fetch locations for filter:", error);
        }
      };
      fetchLocations();
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [locationSearch]);


  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      const s = c.processing_status || c.current_status;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [candidates]);

  const minDate = useMemo(() => {
    if (candidates.length === 0) return new Date();
    let min = new Date();
    candidates.forEach((c) => {
      const d = c.applied_at || c.created_at;
      if (d) {
        const date = new Date(d);
        if (date < min) min = date;
      }
    });
    return min;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Name / email filter
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase().trim();
      const email = (c.email || "").toLowerCase();
      if (
        debouncedNameFilter &&
        !fullName.includes(debouncedNameFilter.toLowerCase()) &&
        !email.includes(debouncedNameFilter.toLowerCase())
      ) {
        return false;
      }

      // Status filter (multi-select)
      if (statusFilter.length > 0) {
        const candidateStatus = c.processing_status || c.current_status || "";
        if (!statusFilter.includes(candidateStatus)) return false;
      }

      // Location filter (multi-select) - Case-insensitive comparison
      if (locationFilter.length > 0) {
        const candidateLocation = (c.location || "").trim().toLowerCase();
        const isMatched = locationFilter.some(
          (filterLoc) => filterLoc.toLowerCase() === candidateLocation
        );
        if (!isMatched) return false;
      }

      // Job filter (multi-select)
      if (jobFilter.length > 0) {
        const candidateJobId = c.applied_job_id || "";
        if (!jobFilter.includes(candidateJobId)) return false;
      }

      // Date range filter
      const rawDate = c.applied_at || c.created_at;
      if (rawDate && (dateRange?.from || dateRange?.to)) {
        const d = new Date(rawDate);
        if (dateRange.from && d < startOfDay(dateRange.from)) return false;
        if (dateRange.to && d > endOfDay(dateRange.to)) return false;
      }

      // HR Decision filter (multi-select)
      if (hrDecisionFilter.length > 0) {
        const decision = c.hr_decision?.toLowerCase() || "pending";
        if (!hrDecisionFilter.includes(decision)) {
          return false;
        }
      }
      if (resumeScreeningFilter.length > 0) {
        let candidateScreening = "fail";
        if (
          c.pass_fail === true ||
          String(c.pass_fail).toLowerCase() === "pass" ||
          (c.resume_score ?? 0) >= passingThreshold
        ) {
          candidateScreening = "pass";
        }

        if (!resumeScreeningFilter.includes(candidateScreening)) {
          return false;
        }
      }

      return true;
    });
  }, [candidates, debouncedNameFilter, statusFilter, locationFilter, hrDecisionFilter, jobFilter, dateRange, resumeScreeningFilter, isServerSide]);

  const hasActiveFilters =
    !!debouncedNameFilter ||
    statusFilter.length > 0 ||
    locationFilter.length > 0 ||
    hrDecisionFilter.length > 0 ||
    jobFilter.length > 0 ||
    resumeScreeningFilter.length > 0 ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const clearFilters = () => {
    setNameFilter("");
    setStatusFilter([]);
    setLocationFilter([]);
    setHrDecisionFilter([]);
    setJobFilter([]);
    setJobSearch("");
    setDateRange({ from: undefined, to: undefined });
    setResumeScreeningFilter([]);
  };

  return {
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
    resumeScreeningFilter,
    setResumeScreeningFilter,
    minDate,
    filteredCandidates,
    hasActiveFilters,
    clearFilters,
    availableJobs,
  };
};
