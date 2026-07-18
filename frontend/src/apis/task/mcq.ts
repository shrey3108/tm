import client from "@/apis/client";
import type { QuestionSetPaperRead, MCQItem } from "@/types/taskPaper";

/**
 * MCQ API endpoints inside a task paper.
 */
export const mcqApis = {
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
   * Updates an existing MCQ in a predefined question set paper.
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
};
