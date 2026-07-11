import apiClient from "@/apis/client";
import type { CandidateResponse } from "@/types/resume";
import type { StageEvaluation } from "@/types/stage";
import type { HiringTimelineResponse } from "@/types/candidate";
import { buildQueryParams } from "@/utils/queryParams";

/**
 * Candidate Management APIs
 */
export const adminCandidateService = {
  /**
   * Get all candidates for a specific job.
   * @param jobId - Job ID
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @returns Promise resolving to candidates and total count
   */
  getCandidatesForJob: async (
    jobId: string,
    skip: number = 0,
    limit: number = 100,
    filters?: {
      hr_decision?: string[];
      city?: string[];
      status?: string[];
      stage_id?: string[];
      result?: string[];
      hr_score?: number[];
      test_email_sent?: boolean;
    },
  ): Promise<{ data: CandidateResponse[]; total: number }> => {
    const response = await apiClient.get<{ data: CandidateResponse[]; total: number }>(
      `/candidates/jobs/${jobId}`,
      {
        params: buildQueryParams({ skip, limit, ...filters }, { convertKeys: false }),
      },
    );
    return response.data;
  },

  /**
   * Search for candidates within a specific job.
   * @param jobId - Job ID
   * @param query - Search term
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @returns Promise resolving to matching candidates
   */
  searchJobCandidates: async (
    jobId: string,
    query?: string,
    skip: number = 0,
    limit: number = 100,
    filters?: {
      hr_decision?: string[];
      city?: string[];
      status?: string[];
      stage_id?: string[];
      result?: string[];
      hr_score?: number[];
      test_email_sent?: boolean;
    },
  ): Promise<{ data: CandidateResponse[]; total: number }> => {
    const response = await apiClient.get<{ data: CandidateResponse[]; total: number }>(
      `/candidates/jobs/${jobId}/search`,
      {
        params: buildQueryParams({ query: query ? query : undefined, skip, limit, ...filters }, { convertKeys: false }),
      },
    );
    return response.data;
  },

  /**
   * Search for candidates across all jobs.
   * @param query - Search term
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @returns Promise resolving to matching candidates
   */
  searchCandidates: async (
    query?: string,
    skip: number = 0,
    limit: number = 100,
    filters?: {
      job?: string[];
      hr_decision?: string[];
      city?: string[];
      status?: string[];
      stage_id?: string[];
      result?: string[];
      hr_score?: number[];
      test_email_sent?: boolean
    },
  ): Promise<{ data: CandidateResponse[]; total: number }> => {
    const response = await apiClient.get<{ data: CandidateResponse[]; total: number }>(
      "/candidates/search",
      {
        params: buildQueryParams({ query: query ? query : undefined, skip, limit, ...filters }, { convertKeys: false }),
      },
    );
    return response.data;
  },

  /**
   * Get all evaluations for a specific candidate.
   * @param candidateId - Candidate ID
   * @returns Promise resolving to sequence of evaluations
   */
  getCandidateEvaluations: async (candidateId: string): Promise<StageEvaluation[]> => {
    const response = await apiClient.get<StageEvaluation[]>(
      `/candidates/${candidateId}/evaluations`,
    );
    return response.data;
  },

  /**
   * Get a specific stage evaluation for a candidate.
   * @param candidateId - Candidate ID
   * @param stageConfigId - Job stage configuration ID
   */
  getStageEvaluation: async (
    candidateId: string,
    stageConfigId: string,
  ): Promise<StageEvaluation> => {
    const response = await apiClient.get<StageEvaluation>(
      `/candidates/${candidateId}/evaluations/${stageConfigId}`,
    );
    return response.data;
  },

  /**
   * Get candidate timeline.
   * @param candidateId - Candidate ID
   * @param jobId - Optional Job ID filter
   */
  getCandidateTimeline: async (
    candidateId: string,
    jobId?: string,
  ): Promise<HiringTimelineResponse> => {
    const response = await apiClient.get<HiringTimelineResponse>(
      `/candidates/${candidateId}/timeline`,
      { params: buildQueryParams({ job_id: jobId }, { convertKeys: false }) },
    );
    return response.data;
  },
};
