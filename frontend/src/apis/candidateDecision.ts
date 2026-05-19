import type { CandidateDecisionFormValues } from "@/schemas/candidate";
import apiClient from "./client";

export interface CandidateDecision {
  id: string;
  candidate_id: string;
  stage_config_id: string | null;
  user_id: string;
  decision: string;
  notes: string | null;
  decided_at: string;
}

export interface CandidateDecisionCreate {
  candidate_id: string;
  decision: CandidateDecisionFormValues["decision"] | "May Be";
  notes?: string;
  stage_config_id?: string
  job_id?: string
  score: number;
}

export interface HrDecisionHistoryItem {
  id: string;
  candidate_id: string;
  stage_config_id: string | null;
  user_id: string;
  decision: CandidateDecisionFormValues["decision"];
  notes: string | null;
  decided_at: string;
  score: number;
  stage_name?: string;
}

export interface HrDecisionHistoryResponse {
  candidate_id: string;
  decisions: HrDecisionHistoryItem[];
  total_decisions: number;
  may_be_count: number;
}

export const candidateDecisionApi = {
  submitDecision: async (data: {
    candidate_id: string;
    decision: CandidateDecisionFormValues['decision']
    note?: string;
    stage_config_id?: string
    job_id?: string
    score: number;
  }) => {
    const backendData: CandidateDecisionCreate = {
      candidate_id: data.candidate_id,
      decision: data.decision === "maybe" ? "May Be" : data.decision,
      notes: data.note,
      stage_config_id: data.stage_config_id,
      job_id: data.job_id,
      score: data.score
    };

    const response = await apiClient.post<CandidateDecision>(
      `/candidates/${data.candidate_id}/decisions`,
      backendData
    );
    return response.data;
  },

  getDecision: async (candidateId: string) => {
    // There's no longer a single decision endpoint, so we fetch history and return the latest
    const response = await apiClient.get<HrDecisionHistoryResponse>(
      `/candidates/${candidateId}/decisions`
    );
    return response.data.decisions.length > 0 ? response.data.decisions[0] : null;
  },

  getDecisionHistory: async (candidateId: string, jobId?: string, stage_config_id?: string) => {
    const response = await apiClient.get<HrDecisionHistoryResponse>(
      `/candidates/${candidateId}/decisions`, {
      params: {
        job_id: jobId,
        stage_config_id: stage_config_id
      }
    }
    );
    return response.data;
  },
};
