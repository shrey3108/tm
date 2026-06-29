import client from "@/apis/client";
import type { Job, JobTitle, JobTitlesGroupedListResponse, JobVersionDetail, JobsListResponse } from "@/types/job";
import type { CandidateAnalysisResponse, JobStatsResponse } from "@/types/admin";
import type { BulkResumeUploadResponse } from "@/types/resume";

type JobPayload = Record<string, unknown>;

/**
 * Job service for managing job postings.
 * Provides methods to fetch available jobs from the API.
 */
const jobService = {
  /**
   * Retrieves a list of job postings.
   * @param skip - Number of records to skip for pagination (default: 0)
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Promise resolving to an array of job postings
   * @example
   * ```ts
   * const jobs = await jobService.getJobs(0, 10);
   * ```
   */
  getJobs: async (skip = 0, limit = 10, filters?: {
    q?: string,
    status?: boolean | boolean[],
    department_id?: string | string[],
  }): Promise<JobsListResponse> => {
    const response = await client.get<JobsListResponse>("/jobs", {
      params: { skip, limit, ...filters },
      paramsSerializer: {
        indexes: null,
      },
    });
    return response.data;
  },

  /**
   * Retrieves a list of job titles.
   * @param q - The search query 
   * @returns Promise resolving to an array of job titles
   * @example
   * ```ts
   * const jobTitles = await jobService.getJobTitles("Software Engineer");
   * ```
   */
  getJobTitles: async (q: string = ""): Promise<{ data: JobTitle[] }> => {
    const response = await client.get<{ data: JobTitle[] }>("/jobs/titles", {
      params: { ...(q ? { q } : undefined) },
    });
    return response.data;
  },

  /**
   * Searches for jobs by title or description.
   * @param query - The search query
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @returns Promise resolving to an array of matching job postings
   */
  searchJobs: async (query: string, skip = 0, limit = 10): Promise<JobsListResponse> => {
    const response = await client.get<JobsListResponse>("/jobs/search", {
      params: { q: query ? query : undefined, skip, limit },
    });
    return response.data;
  },

  /**
   * Creates a new job posting.
   * @param data - The job data to create
   * @returns Promise resolving to the created job
   */
  createJob: async (data: JobPayload): Promise<Job> => {
    const response = await client.post<Job>("/jobs", data);
    return response.data;
  },

  /**
   * Retrieves a single job by its UUID.
   * @param jobId - The UUID of the job
   * @returns Promise resolving to the job details
   */
  getJob: async (jobId: string): Promise<Job> => {
    const response = await client.get<Job>(`/jobs/${jobId}`);
    return response.data;
  },

  /**
   * Retrieves a specific job version snapshot by version UUID.
   * Note: this depends on backend support for a version-details endpoint.
   * @param versionId - The UUID of the job version snapshot
   * @returns Promise resolving to the version snapshot
   */
  getJobVersion: async (versionId: string): Promise<JobVersionDetail> => {
    const response = await client.get<JobVersionDetail>(`/jobs/versions/${versionId}`);
    return response.data;
  },

  /**
   * Updates an existing job posting.
   * @param jobId - The UUID of the job to update
   * @param data - The updated job data
   * @returns Promise resolving to the updated job
   */
  updateJob: async (jobId: string, data: JobPayload): Promise<Job> => {
    const response = await client.patch<Job>(`/jobs/${jobId}`, data);
    return response.data;
  },

  /**
   * Retrieves candidates for a single job with pagination support.
   * @param jobId - The UUID of the job
   * @param jdVersion - Optional JD version number to filter candidates
   * @param skip - Number of records to skip for pagination (default: 0)
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Promise resolving to the list of candidates and total count
   */
  getJobCandidates: async (
    jobId: string,
    jdVersion?: number,
    skip = 0,
    limit = 10,
    candidate_id?: string,
    stage_id?: string,
    filters?: {
      query?: string;
      hr_decision?: string[];
      jd_versions?: number[];
      start_date?: Date;
      end_date?: Date;
      activity_session?: string[];
      stage_id?: string[];
      city?: string[];
      result?: string[];
      hr_score?: number[];
      test_email_sent?: boolean;
      candidate_id?: string;
    },
  ): Promise<CandidateAnalysisResponse> => {
    const response = await client.get<CandidateAnalysisResponse>(`/candidates/jobs/${jobId}`, {
      params: {
        ...(jdVersion !== undefined ? { jd_version: jdVersion } : undefined),
        skip,
        limit,
        // ...filters,
        ...(candidate_id !== undefined ? { candidate_id: candidate_id } : undefined),
        ...(stage_id !== undefined ? { stage_id: stage_id } : undefined),
        ...(filters?.query !== undefined ? { query: filters.query } : undefined),
        ...(filters?.hr_decision !== undefined ? { hr_decision: filters.hr_decision } : undefined),
        ...(filters?.jd_versions !== undefined ? { jd_versions: filters.jd_versions } : undefined),
        ...(filters?.start_date !== undefined ? { start_date: filters.start_date } : undefined),
        ...(filters?.end_date !== undefined ? { end_date: filters.end_date } : undefined),
        ...(filters?.activity_session !== undefined ? { activity_session: filters.activity_session } : undefined),
        ...(filters?.stage_id !== undefined ? { stage_id: filters.stage_id } : undefined),
        ...(filters?.city !== undefined ? { city: filters.city } : undefined),
        ...(filters?.result !== undefined ? { result: filters.result.map(r => r.replace(/ed$/, "")) } : undefined),
        ...(filters?.hr_score !== undefined ? { hr_score: filters.hr_score } : undefined),
        ...(filters?.test_email_sent !== undefined ? { test_email_sent: filters.test_email_sent } : undefined),
        ...(filters?.candidate_id !== undefined ? { candidate_id: filters.candidate_id } : undefined),
      },
      paramsSerializer: {
        indexes: null,
      },
    });
    return response.data;
  },

  /**
   * Triggers re-analysis for a specific candidate against the latest job changes.
   * @param jobId - The UUID of the job
   * @param candidateId - The UUID of the candidate
   * @returns Promise resolving to the API acknowledgement message
   */
  reanalyzeCandidate: async (
    jobId: string,
    candidateId: string,
  ): Promise<{ message: string }> => {
    const response = await client.post<{ message: string }>(
      `/jobs/${jobId}/candidates/${candidateId}/reanalyze`,
    );
    return response.data;
  },

  /**
   * Uploads multiple resumes for a specific job.
   * @param jobId - The UUID of the job
   * @param files - The resume files to upload
   * @returns Promise resolving to the bulk upload response
   */
  uploadResume: async (jobId: string, files: File[]): Promise<BulkResumeUploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("resumes", file);
    });
    const response = await client.post<BulkResumeUploadResponse>(`/jobs/${jobId}/resume`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  /**
   * Deletes a job posting.
   * @param jobId - The UUID of the job to delete
   * @returns Promise resolving to void
   */
  deleteJob: async (jobId: string): Promise<void> => {
    await client.delete(`/jobs/${jobId}`);
  },

  /**
   * Retrieves comprehensive statistics for a specific job.
   * @param jobId - The UUID of the job
   * @returns Promise resolving to the job statistics
   */
  getJobStats: async (jobId: string, filters?: {
    start_date?: Date;
    end_date?: Date;
  }): Promise<JobStatsResponse> => {
    const response = await client.get<JobStatsResponse>(`/candidates/jobs/${jobId}/stats`, {
      params: {
        ...filters,
      },
    });
    return response.data;
  },

  /**
   * Retrieves a list of job titles grouped by position.
   * @param q - The search query 
   * @returns Promise resolving to an array of job titles grouped by position
   */
  getJobTitlesGrouped: async (q: string = ""): Promise<JobTitlesGroupedListResponse> => {
    const response = await client.get<JobTitlesGroupedListResponse>("/jobs/titles/grouped", {
      params: { ...(q ? { q } : undefined) },
    });
    return response.data;
  },
};

export default jobService;
