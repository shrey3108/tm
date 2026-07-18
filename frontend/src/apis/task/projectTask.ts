import client from "@/apis/client";
import type { QuestionSetPaperRead, TaskItem } from "@/types/taskPaper";

/**
 * Project task API endpoints inside a task paper.
 */
export const projectTaskApis = {
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
};
