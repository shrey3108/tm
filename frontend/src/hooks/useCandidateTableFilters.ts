import { useEffect, useMemo, useState } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { UnifiedCandidate } from "@/types/candidate";
import { toTitleCase } from "@/lib/utils";
import { adminLocationService } from "@/apis/admin/location";
import jobService from "@/apis/job";
import { slugify } from "@/utils/slug";
import { DEFAULT_PASSING_THRESHOLD, HR_DECISION_OPTIONS, RESUME_SCREENING_RESULT } from "@/constants";
import type { DateRange } from "react-day-picker";
import { useDebouncedValue } from "./useDebounced";

export interface CandidateActiveFilters {
  status: string[];
  city: string[];
  job: string[];
  hr_decision: string[];
  dateRange?: DateRange | null;
  resumeScreening?: string[];
  stage?: string[];
  activity_session?: string[];
  q?: string;
}

// TODO: Remove after backend update
const normalizeHrDecision = (val: string | null | undefined): string => {
  if (!val) return "pending";
  const s = val.toLowerCase().trim();
  if (s === "approve" || s === "approved" || s === "pass" || s === "passed") return "pass";
  if (s === "reject" || s === "rejected" || s === "fail" || s === "failed") return "fail";
  if (s === "may be" || s === "maybe") return "may be";
  return s;
};

export const useCandidateTableFilters = <T extends UnifiedCandidate>(
  candidates: T[],
  externalNameFilter?: string,
  onNameFilterChange?: (val: string) => void,
  /** Pass false on pages where the job-title filter column is not shown (e.g. per-job
   *  candidates view) to skip the getJobTitles() network request entirely. */
  fetchJobTitles = true,
  isServerSide = false,
  onFiltersChange?: (filters: CandidateActiveFilters) => void,
  passingThreshold = DEFAULT_PASSING_THRESHOLD,
  stageOptionsProp?: string[],
  activitySessionsData?: [number, { start_date: string; end_date: string }][],
  initialDateRange?: DateRange
) => {
  const [internalNameFilter, setInternalNameFilter] = useState("");

  const nameFilter = externalNameFilter !== undefined ? externalNameFilter : internalNameFilter;
  const setNameFilter = onNameFilterChange !== undefined ? onNameFilterChange : setInternalNameFilter;

  // Sync internal name filter with state on mount (removed URL sync)
  useEffect(() => {
    // URL sync removed
  }, []); // Only once on mount


  const debouncedNameFilter = useDebouncedValue(nameFilter);

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [hrDecisionFilter, setHrDecisionFilter] = useState<string[]>([]);

  // jobFilter stores IDs internally for filtering and API calls
  const [jobFilter, setJobFilter] = useState<string[]>([]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const [fetchedLocations, setFetchedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [availableJobs, setAvailableJobs] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [resumeScreeningFilter, setResumeScreeningFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [activitySessionFilter, setActivitySessionFilter] = useState<string[]>([]);
  const [activitySearch, setActivitySearch] = useState("");

  // Handler to update activity session and sync date range in one batch
  const handleActivitySessionChange = (ids: string[]) => {
    setActivitySessionFilter(ids);

    if (ids.length > 0 && activitySessionsData) {
      let minStart: Date | null = null;
      let maxEnd: Date | null = null;

      ids.forEach((id) => {
        const session = activitySessionsData.find(([sid]) => String(sid) === id);
        if (session) {
          const start = new Date(session[1].start_date);
          const end = session[1].end_date ? new Date(session[1].end_date) : new Date();

          if (!minStart || start < minStart) minStart = start;
          if (!maxEnd || end > maxEnd) maxEnd = end;
        }
      });

      if (minStart) {
        setDateRange({ from: minStart, to: maxEnd || undefined });
      }
    }
  };





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
        resumeScreening: resumeScreeningFilter,
        stage: stageFilter,
        activity_session: activitySessionFilter,
        q: debouncedNameFilter
      });
    }
  }, [statusFilter, locationFilter, jobFilter, hrDecisionFilter, dateRange, resumeScreeningFilter, stageFilter, activitySessionFilter, debouncedNameFilter, onFiltersChange]);

  const isAnyFilterActive =
    !!debouncedNameFilter ||
    statusFilter.length > 0 ||
    locationFilter.length > 0 ||
    hrDecisionFilter.length > 0 ||
    jobFilter.length > 0 ||
    resumeScreeningFilter.length > 0 ||
    activitySessionFilter.length > 0 ||
    stageFilter.length > 0 ||
    !!dateRange?.from ||
    !!dateRange?.to;

  useEffect(() => {
    const handler = setTimeout(() => {
      const fetchLocations = async () => {
        try {
          const response = await adminLocationService.getAllLocations(0, 500, locationSearch);
          const names = response.data.map((loc) => toTitleCase(loc.name.trim()));
          setFetchedLocations(names);
        } catch (error) {
          console.error("Failed to fetch locations for filter:", error);
        }
      };
      fetchLocations();
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [locationSearch]);




  // --- Cross-filter helper: applies all filters EXCEPT the one named by `skip` ---
  const crossFilteredCandidates = (skip: string) => {
    return candidates.filter((c) => {
      // Name / email filter
      if (skip !== 'name' && debouncedNameFilter) {
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().trim();
        const email = (c.email || '').toLowerCase();
        if (!fullName.includes(debouncedNameFilter.toLowerCase()) && !email.includes(debouncedNameFilter.toLowerCase())) return false;
      }
      // Status filter
      if (skip !== 'status' && statusFilter.length > 0) {
        const candidateStatus = c.processing_status || c.current_status || '';
        if (!statusFilter.includes(candidateStatus)) return false;
      }
      // Location filter
      if (skip !== 'location' && locationFilter.length > 0) {
        const candidateLocation = (c.location || '').trim().toLowerCase();
        if (!locationFilter.some(f => f.toLowerCase() === candidateLocation)) return false;
      }
      // Job filter
      if (skip !== 'job' && jobFilter.length > 0) {
        if (!jobFilter.includes(c.applied_job_id || '')) return false;
      }
      // Date range filter
      if (skip !== 'date') {
        const rawDate = c.applied_at || c.created_at;
        if (rawDate && (dateRange?.from || dateRange?.to)) {
          const d = new Date(rawDate);
          if (dateRange.from && d < startOfDay(dateRange.from)) return false;
          if (dateRange.to && d > endOfDay(dateRange.to)) return false;
        }
      }
      // HR Decision filter
      if (skip !== 'hrDecision' && hrDecisionFilter.length > 0) {
        const decision = normalizeHrDecision(c.hr_decision);
        if (!hrDecisionFilter.some(d => d.toLowerCase() === decision.toLowerCase())) return false;
      }
      // Resume Screening filter
      if (skip !== 'resumeScreening' && resumeScreeningFilter.length > 0) {
        let candidateScreening = 'failed';
        if (c.pass_fail === true || String(c.pass_fail).toLowerCase() === 'pass' || (c.resume_score ?? 0) >= passingThreshold) {
          candidateScreening = 'passed';
        } else if (c.processing_status === 'processing' || c.processing_status === 'queued' || !c.is_parsed) {
          candidateScreening = 'pending';
        }
        if (!resumeScreeningFilter.includes(candidateScreening)) return false;
      }
      // Stage filter
      if (skip !== 'stage' && stageFilter.length > 0) {
        const candidateStage = c.current_stage?.template_name || '';
        if (!stageFilter.includes(candidateStage)) return false;
      }
      // Activity session filter
      if (skip !== 'activity' && activitySessionFilter.length > 0) {
        const candidateSessionId = String((c as any).activity_session_id || '');
        if (!activitySessionFilter.includes(candidateSessionId)) return false;
      }
      return true;
    });
  };

  // Full static option sets — shown on initial load when no cross-filtering is needed

  const ALL_HR_DECISION_OPTIONS = [
    { value: "pass", label: HR_DECISION_OPTIONS.PASS },
    { value: "May Be", label: HR_DECISION_OPTIONS.MAY_BE },
    { value: "fail", label: HR_DECISION_OPTIONS.FAIL },
    { value: "pending", label: HR_DECISION_OPTIONS.PENDING },
  ];

  const ALL_RESUME_SCREENING_OPTIONS = [
    { value: "passed", label: RESUME_SCREENING_RESULT.PASS },
    { value: "failed", label: RESUME_SCREENING_RESULT.FAIL }
  ];

  const HR_DECISION_LABEL_MAP: Record<string, string> = {
    pass: HR_DECISION_OPTIONS.PASS,
    "may be": HR_DECISION_OPTIONS.MAY_BE,
    fail: HR_DECISION_OPTIONS.FAIL,
    pending: HR_DECISION_OPTIONS.PENDING,
  };

  const RESUME_SCREENING_LABEL_MAP: Record<string, string> = {
    passed: RESUME_SCREENING_RESULT.PASS,
    failed: RESUME_SCREENING_RESULT.FAIL,
    pending: HR_DECISION_OPTIONS.PENDING,
  };


  // Memoized job options: show all initially, then narrow by cross-filtering when filters are active
  const jobOptions = useMemo(() => {
    let baseOptions = availableJobs;

    if (isAnyFilterActive) {
      const subset = crossFilteredCandidates('job');
      const set = new Set<string>();
      subset.forEach((c) => {
        if (c.applied_job_id) set.add(c.applied_job_id);
      });
      // Filter availableJobs to only include those that have candidates in the current subset
      baseOptions = availableJobs.filter(j => set.has(j.id));
    }

    if (!jobSearch.trim()) return baseOptions;
    const query = jobSearch.toLowerCase();
    return baseOptions.filter(j =>
      j.title.toLowerCase().includes(query)
    );
  }, [availableJobs, jobSearch, isAnyFilterActive, candidates, debouncedNameFilter, statusFilter, locationFilter, hrDecisionFilter, dateRange, resumeScreeningFilter, stageFilter, activitySessionFilter, passingThreshold]);


  // --- Dynamic option sets: full static set on initial load, cross-filtered after ---
  const hrDecisionOptions = useMemo(() => {
    if (!isAnyFilterActive) return ALL_HR_DECISION_OPTIONS;
    const subset = crossFilteredCandidates('hrDecision');

    const set = new Set<string>();
    subset.forEach(c => {
      const d = normalizeHrDecision(c.hr_decision);
      set.add(d);
    });
    return Array.from(set).sort().map(v => ({
      value: v === 'may be' ? 'May Be' : v,
      label: HR_DECISION_LABEL_MAP[v] || v,
    }));
  }, [candidates, isAnyFilterActive, debouncedNameFilter, statusFilter, locationFilter, jobFilter, dateRange, resumeScreeningFilter, stageFilter, activitySessionFilter, passingThreshold]);


  const resumeScreeningOptions = useMemo(() => {
    if (!isAnyFilterActive) return ALL_RESUME_SCREENING_OPTIONS;
    const subset = crossFilteredCandidates('resumeScreening');

    const set = new Set<string>();
    subset.forEach(c => {
      let screening = 'failed';
      if (c.pass_fail === true || String(c.pass_fail).toLowerCase() === 'pass' || (c.resume_score ?? 0) >= passingThreshold) {
        screening = 'passed';
      } else if (c.processing_status === 'processing' || c.processing_status === 'queued' || !c.is_parsed) {
        screening = 'pending';
      }
      set.add(screening);
    });
    return Array.from(set).sort().map(v => ({
      value: v,
      label: RESUME_SCREENING_LABEL_MAP[v] || v,
    }));
  }, [candidates, isAnyFilterActive, debouncedNameFilter, statusFilter, locationFilter, jobFilter, dateRange, hrDecisionFilter, stageFilter, activitySessionFilter, passingThreshold]);


  const statusOptions = useMemo(() => {
    const subset = isAnyFilterActive ? crossFilteredCandidates('status') : candidates;
    const set = new Set<string>();

    subset.forEach((c) => {
      const s = c.processing_status || c.current_status;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [candidates, isAnyFilterActive, debouncedNameFilter, locationFilter, jobFilter, dateRange, hrDecisionFilter, resumeScreeningFilter, stageFilter, activitySessionFilter, passingThreshold]);

  const locationOptions = useMemo(() => {
    if (!isAnyFilterActive) {
      return fetchedLocations;
    }
    const subset = crossFilteredCandidates('location');

    const set = new Set<string>();
    subset.forEach((c) => {
      const loc = (c.location || '').trim();
      if (loc) set.add(toTitleCase(loc));
    });
    let options = Array.from(set).sort();
    if (locationSearch) {
      const query = locationSearch.toLowerCase();
      options = options.filter(o => o.toLowerCase().includes(query));
    }
    return options;
  }, [fetchedLocations, candidates, isAnyFilterActive, locationSearch, debouncedNameFilter, statusFilter, jobFilter, dateRange, hrDecisionFilter, resumeScreeningFilter, stageFilter, activitySessionFilter, passingThreshold]);



  const stageOptions = useMemo(() => {
    if (!isAnyFilterActive && stageOptionsProp && stageOptionsProp.length > 0) {
      return stageOptionsProp;
    }
    const subset = isAnyFilterActive ? crossFilteredCandidates('stage') : candidates;
    const set = new Set<string>();
    subset.forEach((c) => {
      const s = c.current_stage?.template_name;
      if (s) set.add(s);
    });
    const derived = Array.from(set).sort();

    if (stageOptionsProp && stageOptionsProp.length > 0) {
      return stageOptionsProp.filter(s => set.has(s));
    }
    return derived;
  }, [candidates, stageOptionsProp, isAnyFilterActive, debouncedNameFilter, statusFilter, locationFilter, jobFilter, dateRange, hrDecisionFilter, resumeScreeningFilter, activitySessionFilter, passingThreshold]);




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
    // if(isServerSide) return candidates; //uncomment when api accepts stages filter

    // If server side is enabled, most filters are handled by the API.
    // However, some filters (like stage) might not be supported by the backend yet,
    // so we apply them locally to the candidates returned by the server.
    if (isServerSide) {
      // If server side is enabled, most filters are handled by the API.
      // However, some filters (like stage, location, result) might not be supported 
      // by the backend yet, so we apply them locally to the candidates returned by the server.
      return candidates.filter((c) => {
        // Stage filter (multi-select)
        if (stageFilter.length > 0) {
          const candidateStage = c.current_stage?.template_name || "";
          if (!stageFilter.includes(candidateStage)) return false;
        }

        // Location filter (multi-select) - Case-insensitive comparison
        if (locationFilter.length > 0) {
          const candidateLocation = (c.location || "").trim().toLowerCase();
          const isMatched = locationFilter.some(
            (filterLoc) => filterLoc.toLowerCase() === candidateLocation
          );
          if (!isMatched) return false;
        }

        // Resume Screening (Result) filter (multi-select)
        if (resumeScreeningFilter.length > 0) {
          let candidateScreening = "failed";
          if (
            c.pass_fail === true ||
            String(c.pass_fail).toLowerCase() === "pass" ||
            (c.resume_score ?? 0) >= passingThreshold
          ) {
            candidateScreening = "passed";
          } else if (c.processing_status === "processing" || c.processing_status === "queued" || !c.is_parsed) {
            candidateScreening = "pending";
          }
          if (!resumeScreeningFilter.includes(candidateScreening)) return false;
        }

        return true;
      });
    }

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
        const decision = normalizeHrDecision(c.hr_decision);
        if (!hrDecisionFilter.some(d => d.toLowerCase() === decision.toLowerCase())) {
          return false;
        }
      }
      if (resumeScreeningFilter.length > 0) {
        let candidateScreening = "failed";
        if (
          c.pass_fail === true ||
          String(c.pass_fail).toLowerCase() === "pass" ||
          (c.resume_score ?? 0) >= passingThreshold
        ) {
          candidateScreening = "passed";
        } else if (c.processing_status === "processing" || c.processing_status === "queued" || !c.is_parsed) {
          candidateScreening = "pending";
        }

        if (!resumeScreeningFilter.includes(candidateScreening)) {
          return false;
        }
      }

      // Stage filter (multi-select)
      if (stageFilter.length > 0) {
        const candidateStage = c.current_stage?.template_name || "";
        if (!stageFilter.includes(candidateStage)) return false;
      }

      // Activity session filter (multi-select)
      if (activitySessionFilter.length > 0) {
        // Assuming candidate has an activity_session_id or similar field. 
        // Based on useJobCandidates, it seems we might need to check if the candidate's creation date 
        // falls within the session range if session_id is not directly on the candidate.
        // However, for now let's assume session_id is a field.
        const candidateSessionId = String((c as any).activity_session_id || "");
        if (!activitySessionFilter.includes(candidateSessionId)) return false;
      }

      return true;
    });
  }, [candidates, debouncedNameFilter, statusFilter, locationFilter, hrDecisionFilter, jobFilter, dateRange, resumeScreeningFilter, stageFilter, activitySessionFilter, isServerSide]);

  const hasActiveFilters = isAnyFilterActive;

  const clearFilters = () => {
    setNameFilter("");
    setStatusFilter([]);
    setLocationFilter([]);
    setHrDecisionFilter([]);
    setJobFilter([]);
    setJobSearch("");
    setDateRange({ from: undefined, to: undefined });
    setResumeScreeningFilter([]);
    setStageFilter([]);
    setActivitySessionFilter([]);
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
    stageFilter,
    setStageFilter,
    stageOptions,
    hrDecisionOptions,
    resumeScreeningOptions,
    minDate,
    filteredCandidates,
    hasActiveFilters,
    clearFilters,
    availableJobs,
    activitySession: activitySessionFilter,
    setActivitySession: handleActivitySessionChange,
    activitySearch,
    setActivitySearch,
  };
};
