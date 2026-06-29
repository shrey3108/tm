import apiClient from "@/apis/client";
import type {
  ResumeStatusResponse,
  JobCandidatesResponse,
  JobResumesResponse,
  CustomExtractionRequest,
  CustomExtractionResponse,
  BulkResumeUploadResponse,
} from "@/types/resume";

/**
 * Resume service for managing candidate resumes and applications.
 * Provides methods to upload resumes, check status, and retrieve candidate information.
 */
export const resumeService = {
  /**
   * Uploads a resume file for a specific job posting.
   * @param jobId - The ID of the job to apply for
   * @param file - The resume file to upload (PDF, DOC, or DOCX)
   * @returns Promise resolving to upload response with processing status
   * @throws {Error} When file type is invalid or upload fails
   * @example
   * ```ts
   * const input = document.querySelector('input[type="file"]');
   * if (input?.files?.[0]) {
   *   const response = await resumeService.uploadResume("job-123", input.files[0]);
   * }
   * ```
   */
  uploadResume: async (jobId: string, files: File[]): Promise<BulkResumeUploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("resumes", file);
    });
    const response = await apiClient.post<BulkResumeUploadResponse>(`/jobs/${jobId}/resume`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  /**
   * Retrieves the processing status of a submitted resume.
   * @param jobId - The ID of the job the resume was submitted for
   * @param resumeId - The unique identifier of the resume
   * @returns Promise resolving to resume status including any analysis results
   */
  getResumeStatus: async (jobId: string, resumeId: string): Promise<ResumeStatusResponse> => {
    const response = await apiClient.get<ResumeStatusResponse>(`/jobs/${jobId}/resume/${resumeId}`);
    return response.data;
  },

  /**
   * Retrieves all candidates who have applied for a specific job.
   * @param jobId - The ID of the job
   * @returns Promise resolving to job candidates response with candidate details
   */
  getJobCandidates: async (jobId: string): Promise<JobCandidatesResponse> => {
    const response = await apiClient.get<JobCandidatesResponse>(`/jobs/${jobId}/candidates`);
    return response.data;
  },

  /**
   * Retrieves all resumes submitted for a specific job.
   * Includes job details and resume processing information.
   * @param jobId - The ID of the job
   * @returns Promise resolving to job resumes response with all submitted resumes
   */
  getJobResumes: async (jobId: string): Promise<JobResumesResponse> => {
    const response = await apiClient.get<JobResumesResponse>(`/jobs/${jobId}/resumes`);
    return response.data;
  },

  /**
   * Extracts custom dynamic fields from a specific resume.
   * @param jobId - The ID of the job
   * @param resumeId - The unique identifier of the resume
   * @param request - The custom fields to extract
   * @returns Promise resolving to the extraction results
   */
  extractCustomFields: async (
    jobId: string,
    resumeId: string,
    request: CustomExtractionRequest,
  ): Promise<CustomExtractionResponse> => {
    const response = await apiClient.post<CustomExtractionResponse>(
      `/jobs/${jobId}/resume/${resumeId}/extract-custom`,
      request,
    );
    return response.data;
  },

  /**
   * Deletes a specific resume and associated candidate data for a job.
   * @param jobId - The ID of the job
   * @param resumeId - The unique identifier of the resume to delete
   * @returns Promise resolving when deletion is complete
   */
  deleteResume: async (jobId: string, resumeId: string): Promise<void> => {
    await apiClient.delete(`/jobs/${jobId}/resumes/${resumeId}`);
  },
};
