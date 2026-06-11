import apiClient from "@/apis/client";
import type {
  EvaluationRead,
  SimilarityScores,
  StageDecisionResponse,
  EvaluationHistoryRead
} from "@/types/candidateStage";
import type {
  StageOverrideCreate,
  StageDecisionCreate,
} from "@/schemas/candidateStage";

/**
 * API service for candidate stage evaluation and decision operations.
 */
export const candidateStageService = {
  /**
   * Retrieve the full evaluation result for a specific candidate stage.
   * @param id - UUID of the candidate stage.
   */
  getEvaluation: async (id: string): Promise<EvaluationRead> => {
    const response = await apiClient.get<EvaluationRead>(
      `/candidate-stages/${id}/evaluation`,
    );
    return response.data;
  },

  /**
   * Retrieve the full evaluation result for all versions of a specific candidate stage.
   * @param stage_id - UUID of the candidate stage.
   */
  getEvaluationHistory: async (stage_id: string): Promise<EvaluationHistoryRead[]> => {
    const response = await apiClient.get<EvaluationHistoryRead[]>(
      `/candidate-stages/${stage_id}/evaluation/history`,
    );
    return response.data;
  },

  /**
   * Get similarity metrics (JD vs Resume, JD vs Transcript, Resume vs Transcript).
   * @param id - UUID of the candidate stage.
   */
  getSimilarityScores: async (id: string): Promise<SimilarityScores> => {
    const response = await apiClient.get<SimilarityScores>(
      `/candidate-stages/${id}/similarity-scores`,
    );
    return response.data;
  },

  /**
   * Override AI evaluation recommendation and/or criterion scores.
   * @param id - UUID of the candidate stage.
   * @param override - Override payload with reason and scores.
   */
  overrideEvaluation: async (
    id: string,
    override: StageOverrideCreate,
  ): Promise<{ message: string; evaluation_id: string }> => {
    const response = await apiClient.post<{
      message: string;
      evaluation_id: string;
    }>(`/candidate-stages/${id}/override`, override);
    return response.data;
  },

  /**
   * Record the final HR decision for this candidate stage.
   * @param id - UUID of the candidate stage.
   * @param decision - Decision payload (Approve, Reject, May Be).
   */
  recordDecision: async (
    id: string,
    decision: StageDecisionCreate,
  ): Promise<StageDecisionResponse> => {
    const response = await apiClient.post<StageDecisionResponse>(
      `/candidate-stages/${id}/decision`,
      decision,
    );
    return response.data;
  },
  /**
   * @deprecated use `candidateDecisionApi.submitDecision`
   * @param stageId 
   * @param decision 
   * @returns 
   */
  stageWiseDecision: async (
    stageId: string,
    decision: StageDecisionCreate,
  ): Promise<StageDecisionResponse> => {
    const response = await apiClient.post<StageDecisionResponse>(
      `/candidate-stages/${stageId}/decision`,
      decision,
    );
    return response.data;
  },

  /**
   * Trigger background GitHub repository evaluation for the Technical Practical Round.
   * @param id - UUID of the candidate stage.
   * @param githubUrl - URL of the GitHub repository.
   */
  evaluateGithub: async (
    id: string,
    githubUrl: string
  ): Promise<{
    message: string;
    candidate_stage_id: string;
    github_url: string;
    status: string;
    evaluation_id: string;
  }> => {
    const response = await apiClient.post<{
      message: string;
      candidate_stage_id: string;
      github_url: string;
      status: string;
      evaluation_id: string;
    }>(`/candidate-stages/${id}/evaluate-github`, { github_url: githubUrl });
    return response.data;
  },
};
