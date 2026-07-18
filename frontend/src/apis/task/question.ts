import client from "@/apis/client";
import type { QuestionSetPaperRead, QuestionItem } from "@/types/taskPaper";

/**
 * Question API endpoints inside a task paper.
 */
export const questionApis = {
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
};
