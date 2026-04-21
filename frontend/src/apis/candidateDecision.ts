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
  decision: "approve" | "reject" | "May Be";
  notes?: string;
  job_id?: string;
}

export interface HrDecisionHistoryItem {
  id: string;
  candidate_id: string;
  stage_config_id: string | null;
  job_id: string | null;
  user_id: string;
  decision: "approve" | "reject" | "May Be";
  notes: string | null;
  decided_at: string;
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
    decision: "approve" | "reject" | "maybe";
    note?: string;
    job_id?: string;
  }) => {
    const backendData: CandidateDecisionCreate = {
      candidate_id: data.candidate_id,
      decision: data.decision === "maybe" ? "May Be" : data.decision,
      notes: data.note,
      job_id: data.job_id,
    };

    const response = await apiClient.post<CandidateDecision>(
      `/candidates/${data.candidate_id}/decisions`,
      backendData
    );
    return response.data;
  },

  getDecision: async (candidateId: string, jobId?: string) => {
    // There's no longer a single decision endpoint, so we fetch history and return the latest
    const url = jobId 
      ? `/candidates/${candidateId}/decisions?job_id=${jobId}`
      : `/candidates/${candidateId}/decisions`;
    const response = await apiClient.get<HrDecisionHistoryResponse>(url);
    return response.data.decisions.length > 0 ? response.data.decisions[0] : null;
  },

  getDecisionHistory: async (candidateId: string, jobId?: string) => {
    const url = jobId 
      ? `/candidates/${candidateId}/decisions?job_id=${jobId}`
      : `/candidates/${candidateId}/decisions`;
    const response = await apiClient.get<HrDecisionHistoryResponse>(url);
    return response.data;
  },
};
