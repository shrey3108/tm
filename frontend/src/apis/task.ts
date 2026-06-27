import client from "@/apis/client";
import type { JobTask, DeleteJobTaskResponse } from "@/types/job";
import type {
  QuestionSetPaperRead,
  QuestionSetPaperListRead,
  QuestionSetPaperCreate,
  CandidateTestPaperRead,
  CandidateTestPaperAssign,
  CandidateTestPaperEmailSend,
  CandidateTestPaperBulkEmailSend,
  JobCandidateSkillsRead,
  MCQItem,
  QuestionItem,
  CandidateTestPaperHistoryRead,
  TaskPaperPreviewResponse,
  TaskItem,
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
   * Retrieves the task file path and extracted skills for a job.
   * @param jobId - The UUID of the job
   * @returns Promise resolving to the job task configuration
   */
  getJobAssignedTask: async (jobId: string, jobStageId?: string): Promise<CandidateTestPaperRead | null> => {
    try {
      const response = await client.get<CandidateTestPaperRead>(`/task-papers/assigned/job/${jobId}`, {
        params: { job_stage_id: jobStageId },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
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
   * Uploads a predefined test paper file (PDF or Word) for a specific department, position level, and skills.
   */
  uploadQuestionSetPaper: async ({
    departmentId,
    positionId,
    skillIds,
    paperType,
    file,
  }: {
    departmentId: string;
    positionId: string;
    skillIds: string[];
    paperType: "normal" | "mcq" | "task" | "mixed";
    file: File;
  }): Promise<QuestionSetPaperRead[]> => {
    const formData = new FormData();
    formData.append("department_id", departmentId);
    formData.append("position_id", positionId);
    formData.append("skill_ids", JSON.stringify(skillIds));
    formData.append("paper_type", paperType);
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
   * Manually creates a new question set paper.
   */
  createQuestionSetPaper: async (
    data: QuestionSetPaperCreate
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.post<QuestionSetPaperRead>(
      "/task-papers/manual",
      data
    );
    return response.data;
  },

  /**
   * Lists all available predefined test paper templates, optionally filtered.
   */
  getQuestionSetPapers: async (
    jobIdOrFilters?: string | {
      departmentId?: string;
      positionId?: string;
      skillId?: string;
      paperType?: string;
      jobId?: string;
      q?: string;
      skip?: number;
      limit?: number;
    },
    positionId?: string
  ): Promise<QuestionSetPaperListRead> => {
    let params: Record<string, any> = {};
    if (typeof jobIdOrFilters === "object" && jobIdOrFilters !== null) {
      params = {
        department_id: jobIdOrFilters.departmentId || undefined,
        position_id: jobIdOrFilters.positionId || undefined,
        skill_id: jobIdOrFilters.skillId || undefined,
        paper_type: jobIdOrFilters.paperType || undefined,
        job_id: jobIdOrFilters.jobId || undefined,
        q: jobIdOrFilters.q || undefined,
        skip: jobIdOrFilters.skip !== undefined ? jobIdOrFilters.skip : undefined,
        limit: jobIdOrFilters.limit !== undefined ? jobIdOrFilters.limit : undefined,
      };
    } else {
      params = {
        job_id: jobIdOrFilters || undefined,
        position_id: positionId || undefined,
      };
    }
    const response = await client.get<QuestionSetPaperListRead>("/task-papers", {
      params,
    });
    return response.data;
  },

  /**
   * Retrieves unique questions, tasks, and MCQs across predefined question set papers.
   */
  getAllQuestionsAndTasks: async (
    filters?: {
      departmentId?: string;
      positionId?: string;
      skillId?: string;
      paperType?: string;
      jobId?: string;
      q?: string;
      skip?: number;
      limit?: number;
    }
  ): Promise<{ questions: (QuestionItem | string)[]; project_task: (TaskItem | string)[]; mcqs: MCQItem[] }> => {
    const params = filters
      ? {
        department_id: filters.departmentId || undefined,
        position_id: filters.positionId || undefined,
        skill_id: filters.skillId || undefined,
        paper_type: filters.paperType || undefined,
        job_id: filters.jobId || undefined,
        q: filters.q || undefined,
        skip: filters.skip !== undefined ? filters.skip : undefined,
        limit: filters.limit !== undefined ? filters.limit : undefined,
      }
      : {};
    const response = await client.get<{ questions: (QuestionItem | string)[]; project_task: (TaskItem | string)[]; mcqs: MCQItem[] }>(
      "/task-papers/all-content",
      { params }
    );
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
    candidateId: string,
    jobStageId?: string
  ): Promise<CandidateTestPaperRead | null> => {
    try {
      const response = await client.get<CandidateTestPaperRead>(
        `/task-papers/assigned/${candidateId}`,
        {
          params: { job_stage_id: jobStageId },
        }
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
  deleteCandidateTestPaper: async (candidateId: string, jobStageId?: string): Promise<void> => {
    await client.delete(`/task-papers/assigned/${candidateId}`, {
      params: { job_stage_id: jobStageId },
    });
  },

  /**
   * Deletes the default common test paper assigned to the job.
   */
  deleteJobDefaultTestPaper: async (jobId: string, jobStageId?: string): Promise<void> => {
    await client.delete(`/task-papers/assigned/job/${jobId}`, {
      params: { job_stage_id: jobStageId },
    });
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
    question: QuestionItem | string,
    skillIds?: string[]
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.post<QuestionSetPaperRead>(
      `/task-papers/${paperId}/questions`,
      { question, skill_ids: skillIds }
    );
    return response.data;
  },

  /**
   * Updates an existing question in a predefined question set paper.
   */
  updateQuestionInPaper: async (
    paperId: string,
    index: number,
    question: QuestionItem | string,
    skillIds?: string[]
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.put<QuestionSetPaperRead>(
      `/task-papers/${paperId}/questions/${index}`,
      { question, skill_ids: skillIds }
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
  /**
   * Adds a mcq to a predefined question set paper.
   */
  addMCQToPaper: async (
    paperId: string,
    mcq: MCQItem,
    skillIds?: string[]
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.post<QuestionSetPaperRead>(
      `/task-papers/${paperId}/mcqs`,
      { mcq, skill_ids: skillIds }
    );
    return response.data;
  },

  /**
   * Updates an existing msq in a predefined question set paper.
   */
  updateMCQInPaper: async (
    paperId: string,
    index: number,
    mcq: MCQItem,
    skillIds?: string[]
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.put<QuestionSetPaperRead>(
      `/task-papers/${paperId}/mcqs/${index}`,
      { mcq, skill_ids: skillIds }
    );
    return response.data;
  },

  /**
   * Deletes a mcq from a predefined question set paper.
   */
  deleteMCQFromPaper: async (
    paperId: string,
    index: number
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.delete<QuestionSetPaperRead>(
      `/task-papers/${paperId}/mcqs/${index}`
    );
    return response.data;
  },

  /**
   * Adds a project task to a predefined question set paper.
   */
  addProjectTaskToPaper: async (
    paperId: string,
    projectTask: TaskItem | string,
    skillIds?: string[]
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.post<QuestionSetPaperRead>(
      `/task-papers/${paperId}/tasks`,
      { task: projectTask, skill_ids: skillIds }
    );
    return response.data;
  },

  /**
   * Updates a project task in a predefined question set paper.
   */
  updateProjectTaskInPaper: async (
    paperId: string,
    index: number,
    projectTask: TaskItem | string,
    skillIds?: string[]
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.put<QuestionSetPaperRead>(
      `/task-papers/${paperId}/tasks/${index}`,
      { task: projectTask, skill_ids: skillIds }
    );
    return response.data;
  },

  /**
   * Deletes a project task from a predefined question set paper.
   */
  deleteProjectTaskFromPaper: async (
    paperId: string,
    index: number
  ): Promise<QuestionSetPaperRead> => {
    const response = await client.delete<QuestionSetPaperRead>(
      `/task-papers/${paperId}/tasks/${index}`
    );
    return response.data;
  },



  /**
   * Retrieves the assignment and email log history for a specific candidate.
   */
  getCandidateTestPaperHistory: async (
    candidateId: string,
    jobStageId?: string
  ): Promise<CandidateTestPaperHistoryRead[]> => {
    const response = await client.get<CandidateTestPaperHistoryRead[]>(
      `/task-papers/assigned/${candidateId}/history`,
      {
        params: { job_stage_id: jobStageId },
      }
    );
    return response.data;
  },

  /**
   * Retrieves the assignment and email log history for all candidates under a specific job.
   */
  getJobTestPaperHistory: async (
    jobId: string,
    jobStageId?: string
  ): Promise<CandidateTestPaperHistoryRead[]> => {
    const response = await client.get<CandidateTestPaperHistoryRead[]>(
      `/task-papers/assigned/job/${jobId}/history`,
      {
        params: { job_stage_id: jobStageId },
      }
    );
    return response.data;
  },

  /**
   * Generates a random preview of questions, MCQs, and project tasks based on a job's skills
   * or explicitly provided department, position, and skills.
   */
  previewRandomQuestions: async (
    params: {
      jobId?: string;
      departmentId?: string;
      positionId?: string;
      skillIds?: string[];
      count?: number;
    }
  ): Promise<TaskPaperPreviewResponse> => {
    const response = await client.get<TaskPaperPreviewResponse>(
      "/task-papers/preview-random",
      {
        params: {
          job_id: params.jobId || undefined,
          department_id: params.departmentId || undefined,
          position_id: params.positionId || undefined,
          skill_ids: params.skillIds || undefined,
          count: params.count || undefined,
        },
      }
    );
    return response.data;
  },
};

export interface CandidateTaskRead {
  task_file_path: string | null;
  task_skills: string[];
  is_custom_task: boolean;
}
