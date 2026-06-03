import client from "@/apis/client";
import type { JobTask, DeleteJobTaskResponse } from "@/types/job";

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
};
