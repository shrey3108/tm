import { useEffect, useMemo, useState } from "react";
import { startOfDay, endOfDay } from "date-fns";
import type { UnifiedCandidate } from "@/types/candidate";
import { toTitleCase } from "@/lib/utils";
import { slugify } from "@/utils/slug";
import { DEFAULT_PASSING_THRESHOLD, HR_DECISION_OPTIONS, RESUME_SCREENING_RESULT } from "@/constants";
import type { DateRange } from "react-day-picker";
import { useDebouncedValue } from "./useDebounced";
import { useJobTitle } from "@/hooks/queries/jobs/useJob"
import { useAdminLocations } from "./queries/admin/useLocation";

export interface CandidateActiveFilters {
  status: string[];
  city: string[];
  job: string[];
  hr_decision: string[];
  dateRange?: DateRange | null;
  result?: string[];
  stage_id?: string[];
  q?: string;
  hr_score?: number[];
  test_email_sent?: boolean;
}


export const useCandidateTableFilters = <T extends UnifiedCandidate>(
  candidates: T[],
  filters: CandidateActiveFilters,
  setFilters: (filters: Partial<CandidateActiveFilters>) => void,
  /** Pass false on pages where the job-title filter column is not shown (e.g. per-job
   *  candidates view) to skip the getJobTitles() network request entirely. */
  fetchJobTitles = true,
  isServerSide = false,
  passingThreshold = DEFAULT_PASSING_THRESHOLD,
  stageOptionsProp?: { id: string; name: string }[],
  externalNameFilter?: string,
  onNameFilterChange?: (val: string) => void
) => {
  const statusFilter = filters.status || [];
  const locationFilter = filters.city || [];
  const hrDecisionFilter = filters.hr_decision || [];
  const hrScoreFilter = filters.hr_score || [];
  const jobFilter = filters.job || [];
  const dateRange = filters.dateRange || undefined;
  const resultFilter = filters.result || [];
  const stageFilter = filters.stage_id || [];

  const testEmailSentFilter = filters.test_email_sent === true ? "sent" : filters.test_email_sent === false ? "not_sent" : undefined;

  const nameFilter = externalNameFilter !== undefined ? externalNameFilter : ("");

  const setNameFilter = (val: string) => {
    if (onNameFilterChange) {
      onNameFilterChange(val);
    } else {
      setFilters({ q: val });
    }
  };

  const setStatusFilter = (val: string[]) => setFilters({ status: val });
  const setLocationFilter = (val: string[]) => setFilters({ city: val });
  const setHrDecisionFilter = (val: string[]) => setFilters({ hr_decision: val });
  const setHrScoreFilter = (val: number[]) => setFilters({ hr_score: val });
  const setJobFilter = (val: string[]) => setFilters({ job: val });
  const setDateRange = (val: DateRange | undefined) => setFilters({ dateRange: val });
  const setResultFilter = (val: string[]) => setFilters({ result: val });
  const setStageFilter = (val: string[]) => setFilters({ stage_id: val });
  const setTestEmailSentFilter = (val: string | undefined) => {
    setFilters({
      test_email_sent: val === "sent" ? true : val === "not_sent" ? false : undefined
    });
  };

  const [fetchedLocations, setFetchedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [availableJobs, setAvailableJobs] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [jobSearch, setJobSearch] = useState("");


  const debouncedNameFilter = useDebouncedValue(nameFilter);
  const debouncedJobSearch = useDebouncedValue(jobSearch);
  const debouncedLocationSearch = useDebouncedValue(locationSearch);


  const { data: jobs } = useJobTitle(debouncedJobSearch, fetchJobTitles);
  useEffect(() => {
    if (jobs) {
      const jobsArray = Array.isArray(jobs) ? jobs : (jobs as any)?.data ?? [];
      setAvailableJobs(
        jobsArray.map((j: any) => ({
          id: j.id,
          title: j.title?.trim() || "Untitled",
          slug: slugify(j.title || ""),
        }))
      );
    }
  }, [jobs]);

  const { data: locations } = useAdminLocations(0, 500, debouncedLocationSearch);
  useEffect(() => {
    if (locations) {
      const names = locations.map((loc) => toTitleCase(loc.name.trim()));
      setFetchedLocations(names);
    }
  }, [locations]);

  const isAnyFilterActive =
    !!debouncedNameFilter ||
    statusFilter.length > 0 ||
    locationFilter.length > 0 ||
    hrDecisionFilter.length > 0 ||
    jobFilter.length > 0 ||
    resultFilter.length > 0 ||

    stageFilter.length > 0 ||
    hrScoreFilter.length > 0 ||
    !!dateRange?.from ||
    !!dateRange?.to ||
    !!testEmailSentFilter;

  // Resolve selected stage IDs to their normalized names so we can match
  // candidates by stage name across different jobs (stages are deduplicated by name).
  const selectedStageNames = useMemo(() => {
    if (stageFilter.length === 0) return [] as string[];
    const names = new Set<string>();
    stageFilter.forEach(id => {
      const c = candidates.find(c => c.current_stage?.job_stage_id === id);
      if (c?.current_stage?.template_name) {
        names.add(c.current_stage.template_name.trim().toLowerCase());
      }
    });
    return Array.from(names);
  }, [stageFilter, candidates]);



  // Full static option sets — shown on initial load when no cross-filtering is needed

  const ALL_HR_DECISION_OPTIONS = [
    { value: "pass", label: HR_DECISION_OPTIONS.PASS },
    { value: "May Be", label: HR_DECISION_OPTIONS.MAY_BE },
    { value: "fail", label: HR_DECISION_OPTIONS.FAIL },
    { value: "pending", label: HR_DECISION_OPTIONS.PENDING },
  ];

  const ALL_RESULT_OPTIONS = [
    { value: "pass", label: RESUME_SCREENING_RESULT.PASS },
    { value: "fail", label: RESUME_SCREENING_RESULT.FAIL }
  ];



  const jobOptions = useMemo(() => {
    let baseOptions = availableJobs;
    if (!jobSearch.trim()) return baseOptions;
    const query = jobSearch.toLowerCase();
    return baseOptions.filter(j =>
      j.title.toLowerCase().includes(query)
    );
  }, [availableJobs, jobSearch]);

  const hrDecisionOptions = ALL_HR_DECISION_OPTIONS;
  const resultOptions = ALL_RESULT_OPTIONS;

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      const s = c.processing_status || c.current_status;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [candidates]);

  const locationOptions = useMemo(() => {
    let options = fetchedLocations;
    if (locationSearch) {
      const query = locationSearch.toLowerCase();
      options = options.filter(o => o.toLowerCase().includes(query));
    }
    return options;
  }, [fetchedLocations, locationSearch]);

  const stageOptions = useMemo(() => {
    if (stageOptionsProp && stageOptionsProp.length > 0) {
      // Deduplicate stageOptionsProp by name
      const seen = new Map<string, { id: string; name: string }>();
      stageOptionsProp.forEach(s => {
        const key = s.name.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, s);
        }
      });
      return Array.from(seen.values());
    }

    const nameMap = new Map<string, { id: string; name: string; order: number }>();
    candidates.forEach((c) => {
      const id = c.current_stage?.job_stage_id;
      const name = c.current_stage?.template_name;
      const order = c.current_stage?.order ?? 0;
      if (id && name) {
        const key = name.trim().toLowerCase();
        if (!nameMap.has(key)) {
          nameMap.set(key, { id, name, order });
        }
      }
    });

    return Array.from(nameMap.values())
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(({ id, name }) => ({ id, name }));
  }, [candidates, stageOptionsProp]);

  const isTechnicalPracticalRoundSelected = useMemo(() => {
    return stageFilter.some((id) => {
      const stage = stageOptions.find((s) => s.id === id);
      const name = stage?.name.toLowerCase();
      return name === "technical practical round" || name === "coding test round";
    });
  }, [stageFilter, stageOptions]);

  const isDecisionPendingSelected = useMemo(() => {
    return hrDecisionFilter.some((d) => d.toLowerCase() === "pending");
  }, [hrDecisionFilter]);

  const isTestPaperFilterEnabled = isTechnicalPracticalRoundSelected && isDecisionPendingSelected;

  useEffect(() => {
    if (!isTestPaperFilterEnabled && testEmailSentFilter !== undefined) {
      setTestEmailSentFilter(undefined);
    }
  }, [isTestPaperFilterEnabled, testEmailSentFilter]);


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
    if (isServerSide) return candidates;

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
        const decision = c?.hr_decision;
        if (!hrDecisionFilter.some(d => d.toLowerCase() === decision?.toLowerCase())) {
          return false;
        }
      }
      if (resultFilter.length > 0) {
        let candidateResult = "failed";
        if (
          c.pass_fail === true ||
          String(c.pass_fail).toLowerCase() === "pass" ||
          (c.resume_score ?? 0) >= passingThreshold
        ) {
          candidateResult = "passed";
        } else if (c.processing_status === "processing" || c.processing_status === "queued" || !c.is_parsed) {
          candidateResult = "pending";
        }

        if (!resultFilter.includes(candidateResult)) {
          return false;
        }
      }

      // Stage filter (multi-select) — match by name (stages are deduplicated by name across jobs)
      if (stageFilter.length > 0) {
        const candidateStageId = c.current_stage?.job_stage_id || "";
        const candidateStageName = (c.current_stage?.template_name || "").trim().toLowerCase();
        const matchesById = stageFilter.includes(candidateStageId);
        const matchesByName = selectedStageNames.some(n => n === candidateStageName);
        if (!matchesById && !matchesByName) return false;
      }



      // Score rating filter (multi-select)
      if (hrScoreFilter.length > 0) {
        const score = c.hr_score ?? null;
        if (score === null || !hrScoreFilter.includes(score)) return false;
      }

      // Test paper filter
      if (testEmailSentFilter) {

        if (c.test_email_sent !== undefined) {

          const isSent = c.test_email_sent === true
          const filterSent = testEmailSentFilter === "sent";
          if (isSent !== filterSent) return false;
        }
      }

      return true;
    });
  }, [candidates, debouncedNameFilter, statusFilter, locationFilter, hrDecisionFilter, jobFilter, dateRange, resultFilter, stageFilter, selectedStageNames, hrScoreFilter, testEmailSentFilter, isServerSide]);

  const hasActiveFilters = isAnyFilterActive;

  const clearFilters = () => {
    setJobSearch("");
    setFilters({
      q: "",
      status: [],
      city: [],
      hr_decision: [],
      job: [],
      dateRange: undefined,
      result: [],
      stage_id: [],
      hr_score: [],
      test_email_sent: undefined,
    });
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
    resultFilter,
    setResultFilter,
    stageFilter,
    setStageFilter,
    stageOptions,
    hrDecisionOptions,
    resultOptions,
    minDate,
    filteredCandidates,
    hasActiveFilters,
    clearFilters,
    availableJobs,
    hrScoreFilter,
    setHrScoreFilter,
    testEmailSentFilter,
    setTestEmailSentFilter,
    isTestPaperFilterEnabled,
  };
};
