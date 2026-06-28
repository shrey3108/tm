import apiClient from "@/apis/client";
import type { JobVersionDetail } from "@/types/job";
import type {
  JobRead,
  JobStageConfigCreate,
  JobStageConfigUpdate,
  JobStageReorder,
} from "@/types/admin";
import type { JobUpdate, JobCreate } from "@/types/job";
import type { JobResumeInfoResponse, JobResumesResponse } from "@/types/resume";
import type { JobStageConfig } from "@/types/stage";

/**
 * Job Management APIs
 */
export const adminJobService = {
  /**
   * Get all jobs with pagination.
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @returns Promise resolving to the list of jobs
   */
  getAllJobs: async (
    skip: number = 0,
    limit: number = 100,
    filters?: {
      q?: string;
      status?: boolean | boolean[];
      department_id?: string | string[];
    },
  ): Promise<{ data: JobRead[]; total: number }> => {
    const response = await apiClient.get<{ data: JobRead[]; total: number }>("/jobs", {
      params: { skip, limit, ...filters },
      paramsSerializer: {
        indexes: null,
      },
    });
    return response.data;
  },

  /**
   * Search for jobs by query.
   * @param query - Search term
   * @param skip - Number of records to skip
   * @param limit - Maximum number of records to return
   * @returns Promise resolving to matching jobs
   */
  searchJobs: async (query: string, skip: number = 0, limit: number = 100): Promise<JobRead[]> => {
    const response = await apiClient.get<{ data: JobRead[]; total: number }>("/jobs/search", {
      params: { q: query ? query : undefined, skip, limit },
    });
    return response.data.data;
  },

  /**
   * Create a new job posting.
   * @param job - Job creation payload
   * @returns Promise resolving to the created job
   */
  createJob: async (job: JobCreate): Promise<JobRead> => {
    const response = await apiClient.post<JobRead>("/jobs", job);
    return response.data;
  },

  /**
   * Get job details by ID.
   * @param jobId - Job ID
   * @returns Promise resolving to job details
   */
  getJobById: async (jobId: string): Promise<JobRead> => {
    const response = await apiClient.get<JobRead>(`/jobs/${jobId}`);
    return response.data;
  },

  /**
   * Update an existing job.
   * @param jobId - Job ID
   * @param job - Job update payload
   * @returns Promise resolving to updated job details
   */
  updateJob: async (jobId: string, job: JobUpdate): Promise<JobRead> => {
    const response = await apiClient.patch<JobRead>(`/jobs/${jobId}`, job);
    return response.data;
  },

  /**
   * Delete a job posting.
   * @param jobId - Job ID
   */
  deleteJob: async (jobId: string): Promise<void> => {
    await apiClient.delete(`/jobs/${jobId}`);
  },

  /**
   * Get all resumes submitted for a job.
   * @param jobId - Job ID
   * @returns Promise resolving to job resumes
   */
  getJobResumes: async (jobId: string): Promise<JobResumesResponse> => {
    const response = await apiClient.get<JobResumesResponse>(`/jobs/${jobId}/resumes`);
    return response.data;
  },

  /**
   * Job Stage Configuration
   */
  /**
   * Get configured stages for a specific job.
   * @param jobId - Job ID
   * @returns Promise resolving to job stage configurations
   */
  getJobStages: async (jobId: string): Promise<JobStageConfig[]> => {
    const response = await apiClient.get<JobStageConfig[]>(`/jobs/${jobId}/stages`);
    return response.data;
  },

  /**
   * Add a new stage to a job's workflow.
   * @param jobId - Job ID
   * @param stage - Stage configuration payload
   * @returns Promise resolving to the added stage configuration
   */
  addStageToJob: async (jobId: string, stage: JobStageConfigCreate): Promise<JobStageConfig> => {
    const response = await apiClient.post<JobStageConfig>(`/jobs/${jobId}/stages`, stage);
    return response.data;
  },

  /**
   * Update a specific stage configuration for a job.
   * @param jobId - Job ID
   * @param configId - Configuration ID
   * @param stage - Update payload
   * @returns Promise resolving to updated configuration
   */
  updateJobStage: async (
    jobId: string,
    configId: string,
    stage: JobStageConfigUpdate,
  ): Promise<JobStageConfig> => {
    const response = await apiClient.patch<JobStageConfig>(
      `/jobs/${jobId}/stages/${configId}`,
      stage,
    );
    return response.data;
  },

  /**
   * Remove a stage from a job's workflow.
   * @param jobId - Job ID
   * @param configId - Configuration ID
   */
  removeStageFromJob: async (jobId: string, configId: string): Promise<void> => {
    await apiClient.delete(`/jobs/${jobId}/stages/${configId}`);
  },

  /**
   * Reorder stages for a job.
   * @param jobId - Job ID
   * @param reorder - Reorder instructions
   * @returns Promise resolving to the new list of configurations
   */
  reorderJobStages: async (jobId: string, reorder: JobStageReorder): Promise<JobStageConfig[]> => {
    const response = await apiClient.put<JobStageConfig[]>(
      `/jobs/${jobId}/stages/reorder`,
      reorder,
    );
    return response.data;
  },

  /**
   * Refresh custom extractions for all resumes in a job.
   * Only accessible by admin.
   * @param jobId - Job ID
   */
  refreshCustomExtractions: async (jobId: string): Promise<void> => {
    await apiClient.post(`/job/${jobId}/refresh-custom-extractions`);
  },

  /**
   * Get detailed information for a specific resume in a job.
   * Only accessible by admin.
   * @param jobId - Job ID
   * @param resumeId - Resume ID
   * @returns Promise resolving to resume details
   */
  /**
   * Get detailed information for a specific resume in a job.
   * Only accessible by admin.
   * @param jobId - Job ID
   * @param resumeId - Resume ID
   * @returns Promise resolving to resume details
   */
  getJobResumeDetail: async (jobId: string, resumeId: string): Promise<JobResumeInfoResponse> => {
    const response = await apiClient.get<JobResumeInfoResponse>(
      `/job/${jobId}/resumes/${resumeId}`,
    );
    return response.data;
  },

  /**
   * Retrieves a specific job version snapshot by its unique record ID.
   * @param versionId - Unique identifier of the version snapshot
   * @returns Promise resolving to the version details
   */
  getJobVersion: async (versionId: string): Promise<JobVersionDetail> => {
    const response = await apiClient.get<JobVersionDetail>(`/jobs/versions/${versionId}`);
    return response.data;
  },
};
