import apiClient from "@/apis/client";
import type {
  EvaluationRead,
  SimilarityScores,
  StageDecisionResponse,
  EvaluationHistoryRead,
  SendToAssociatesResponse,
} from "@/types/candidateStage";
import type {
  StageOverrideCreate,
  StageDecisionCreate,
  SendToAssociatesRequest,
} from "@/schemas/candidateStage";
import type { AssociateResultsResponse } from "@/types/associateReview";

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
    githubUrl?: string
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

  /**
   * Submit a GitHub repository URL without triggering evaluation.
   */
  submitGithub: async (
    id: string,
    githubUrl: string
  ): Promise<{
    message: string;
    candidate_stage_id: string;
    status: string;
  }> => {
    const response = await apiClient.post<{
      message: string;
      candidate_stage_id: string;
      status: string;
    }>(`/candidate-stages/${id}/submit-github`, { github_url: githubUrl });
    return response.data;
  },

  /**
   * Retry a failed evaluation for a candidate stage without re-entering inputs.
   * @param id - UUID of the candidate stage.
   */
  retryEvaluation: async (
    id: string
  ): Promise<{
    message: string;
    candidate_stage_id: string;
    status: string;
  }> => {
    const response = await apiClient.post<{
      message: string;
      candidate_stage_id: string;
      status: string;
    }>(`/candidate-stages/${id}/retry`);
    return response.data;
  },

  /**
   * Delete all evaluation results and decisions for a candidate stage, resetting its status to pending.
   * @param id - UUID of the candidate stage.
   */
  deleteResults: async (
    id: string
  ): Promise<{
    message: string;
    candidate_stage_id: string;
    status: string;
  }> => {
    const response = await apiClient.delete<{
      message: string;
      candidate_stage_id: string;
      status: string;
    }>(`/candidate-stages/${id}/results`);
    return response.data;
  },

  /**
   * Send the default test paper + candidate GitHub URL to multiple associates via email.
   * @param id - UUID of the candidate stage.
   * @param payload - Request body containing associate IDs.
   */
  sendToAssociates: async (
    id: string,
    payload: SendToAssociatesRequest
  ): Promise<SendToAssociatesResponse> => {
    const response = await apiClient.post<SendToAssociatesResponse>(
      `/candidate-stages/${id}/send-to-associates`,
      payload
    );
    return response.data;
  },

  /**
   * Retrieve all associate evaluation results for a candidate stage.
   * @param id - UUID of the candidate stage.
   */
  getAssociateResults: async (id: string): Promise<AssociateResultsResponse> => {
    const response = await apiClient.get<AssociateResultsResponse>(
      `/candidate-stages/${id}/associate-results`
    );
    return response.data;
  },
};
