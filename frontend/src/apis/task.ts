import client from "@/apis/client";
import type { JobTask, DeleteJobTaskResponse } from "@/types/job";
import type {
  QuestionSetPaperRead,
  CandidateTestPaperRead,
  CandidateTestPaperAssign,
  CandidateTestPaperEmailSend,
  CandidateTestPaperBulkEmailSend,
  JobCandidateSkillsRead,
} from "@/types/taskPaper";

/**
 * Task service for managing candidate tasks linked to jobs.
 */
export const taskService = {
  /**
   * Retrieves the task file path and extracted skills for a job.
   * @param jobId - The UUID of the job
   * @returns Promise resolving to the job task configuration
   */
  getJobTask: async (jobId: string): Promise<JobTask> => {
    const response = await client.get<JobTask>(`/jobs/${jobId}/task`);
    return response.data;
  },

  /**
   * Uploads a candidate task PDF for a specific job and extracts skills.
   * @param jobId - The UUID of the job
   * @param file - The task PDF file to upload
   * @returns Promise resolving to the updated job task details
   */
  uploadJobTask: async (jobId: string, file: File): Promise<JobTask> => {
    const formData = new FormData();
    formData.append("task_file", file);
    const response = await client.post<JobTask>(`/jobs/${jobId}/task`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  /**
   * Deletes the candidate task and resets task skills for a specific job.
   * @param jobId - The UUID of the job
   * @returns Promise resolving to success message
   */
  deleteJobTask: async (jobId: string): Promise<DeleteJobTaskResponse> => {
    const response = await client.delete<DeleteJobTaskResponse>(`/jobs/${jobId}/task`);
    return response.data;
  },

  /**
   * Uploads a candidate-specific task PDF/DOCX and triggers skills extraction.
   * @param candidateId - The UUID of the candidate
   * @param file - The task file to upload
   * @returns Promise resolving to the candidate task details
   */
  uploadCandidateTask: async (candidateId: string, file: File): Promise<CandidateTaskRead> => {
    const formData = new FormData();
    formData.append("task_file", file);
    const response = await client.post<CandidateTaskRead>(`/candidates/${candidateId}/task`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  /**
     * Download a candidate-specific task PDF/DOCX.
     * @param candidateId - The UUID of the candidate
     * @returns Promise resolving to the file Blob
     */
  downloadCandidateTask: async (candidateId: string): Promise<Blob> => {
    const response = await client.get(`/candidates/${candidateId}/task/file`, {
      responseType: "blob",
      headers: { "Content-Type": undefined },
    });
    const contentType = response.headers["content-type"] || "application/octet-stream"; // content type from response headers other wise octet-stream handle all binary type files.
    return new Blob([response.data], { type: contentType });
  },
  /**
     * Download the default job task PDF/DOCX.
     * @param jobId - The UUID of the job
     * @returns Promise resolving to the file Blob
     */
  downloadJobTask: async (jobId: string): Promise<Blob> => {
    const response = await client.get(`/jobs/${jobId}/task/file`, {
      responseType: "blob",
      headers: { "Content-Type": undefined },
    });
    const contentType = response.headers["content-type"] || "application/octet-stream";
    return new Blob([response.data], { type: contentType });
  },

  /**
   * Uploads a predefined test paper file (PDF or Word) for a specific job and position level.
   */
  uploadQuestionSetPaper: async ({
    jobId,
    positionId,
    file,
  }: {
    jobId: string;
    positionId: string;
    file: File;
  }): Promise<QuestionSetPaperRead[]> => {
    const formData = new FormData();
    formData.append("job_id", jobId);
    formData.append("position_id", positionId);
    formData.append("task_file", file);
    const response = await client.post<QuestionSetPaperRead[]>(
      "/task-papers/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  /**
   * Lists all available predefined test paper templates, optionally filtered.
   */
  getQuestionSetPapers: async (
    jobId?: string,
    positionId?: string
  ): Promise<QuestionSetPaperRead[]> => {
    const response = await client.get<QuestionSetPaperRead[]>("/task-papers", {
      params: {
        job_id: jobId || undefined,
        position_id: positionId || undefined,
      },
    });
    return response.data;
  },

  /**
   * Retrieves details of a specific predefined paper template.
   */
  getQuestionSetPaper: async (paperId: string): Promise<QuestionSetPaperRead> => {
    const response = await client.get<QuestionSetPaperRead>(
      `/task-papers/${paperId}`
    );
    return response.data;
  },

  /**
   * Removes a predefined paper template from the library.
   */
  deleteQuestionSetPaper: async (paperId: string): Promise<void> => {
    await client.delete(`/task-papers/${paperId}`);
  },

  /**
   * Downloads the actual document file associated with a predefined template.
   */
  downloadPaperTaskFile: async (paperId: string): Promise<Blob> => {
    const response = await client.get(`/task-papers/${paperId}/task-file`, {
      responseType: "blob",
      headers: { "Content-Type": undefined },
    });
    const contentType = response.headers["content-type"] || "application/octet-stream";
    return new Blob([response.data], { type: contentType });
  },

  /**
   * Assigns a test paper to a candidate.
   */
  assignTestPaperToCandidate: async (
    data: CandidateTestPaperAssign
  ): Promise<CandidateTestPaperRead> => {
    const response = await client.post<CandidateTestPaperRead>(
      "/task-papers/assign",
      data
    );
    return response.data;
  },

  /**
   * Retrieves the details of a paper currently assigned to a candidate.
   */
  getCandidateTestPaper: async (
    candidateId: string
  ): Promise<CandidateTestPaperRead | null> => {
    try {
      const response = await client.get<CandidateTestPaperRead>(
        `/task-papers/assigned/${candidateId}`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Unassigns/removes the test paper from the candidate's profile.
   */
  deleteCandidateTestPaper: async (candidateId: string): Promise<void> => {
    await client.delete(`/task-papers/assigned/${candidateId}`);
  },

  /**
   * Deletes the default common test paper assigned to the job.
   */
  deleteJobDefaultTestPaper: async (jobId: string): Promise<void> => {
    await client.delete(`/task-papers/assigned/job/${jobId}`);
  },

  /**
   * Returns task metadata (path, skills, custom flag) via candidate task service.
   */
  readCandidateTaskMetadata: async (
    candidateId: string
  ): Promise<CandidateTaskRead> => {
    const response = await client.get<CandidateTaskRead>(
      `/task-papers/assigned/${candidateId}/task`
    );
    return response.data;
  },

  /**
   * Returns a consolidated list of skills required for the job and candidate's task skills.
   */
  getJobAndCandidateTaskSkills: async (
    candidateId: string,
    jobId: string
  ): Promise<JobCandidateSkillsRead> => {
    const response = await client.get<JobCandidateSkillsRead>(
      `/task-papers/assigned/${candidateId}/jobs/${jobId}/skills`
    );
    return response.data;
  },

  /**
   * Downloads the specific task file assigned to the candidate.
   */
  downloadCandidateAssignedTaskFile: async (
    candidateId: string
  ): Promise<Blob> => {
    const response = await client.get(
      `/task-papers/assigned/${candidateId}/task/file`,
      {
        responseType: "blob",
        headers: { "Content-Type": undefined },
      }
    );
    const contentType = response.headers["content-type"] || "application/octet-stream";
    return new Blob([response.data], { type: contentType });
  },

  /**
   * Triggers a notification to the candidate containing their assigned paper.
   */
  sendTestPaperEmail: async (
    data: CandidateTestPaperEmailSend
  ): Promise<{ status: string; message: string }> => {
    const response = await client.post<{ status: string; message: string }>(
      "/task-papers/send-email",
      data
    );
    return response.data;
  },

  /**
   * Triggers a notification to multiple candidates containing the assigned paper in bulk.
   */
  sendBulkTestPaperEmail: async (
    data: CandidateTestPaperBulkEmailSend
  ): Promise<{ status: string; message: string; sent_to: string[]; failed: any[] }> => {
    const response = await client.post<{
      status: string;
      message: string;
      sent_to: string[];
      failed: any[];
    }>("/task-papers/send-email/bulk", data);
    return response.data;
  },

  /**
   * Adds a question to a predefined question set paper.
   */
  addQuestionToPaper: async (
    paperId: string,
    question: string
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.post<QuestionSetPaperRead>(
      `/task-papers/${paperId}/questions`,
      { question }
    );
    return response.data;
  },

  /**
   * Updates an existing question in a predefined question set paper.
   */
  updateQuestionInPaper: async (
    paperId: string,
    index: number,
    question: string
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.put<QuestionSetPaperRead>(
      `/task-papers/${paperId}/questions/${index}`,
      { question }
    );
    return response.data;
  },

  /**
   * Deletes a question from a predefined question set paper.
   */
  deleteQuestionFromPaper: async (
    paperId: string,
    index: number
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.delete<QuestionSetPaperRead>(
      `/task-papers/${paperId}/questions/${index}`
    );
    return response.data;
  },
};

export interface CandidateTaskRead {
  task_file_path: string | null;
  task_skills: string[];
  is_custom_task: boolean;
}
