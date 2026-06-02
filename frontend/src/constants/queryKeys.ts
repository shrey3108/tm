/**
 * Constants for TanStack Query Keys
 */
export const QUERY_KEYS = {
  ADMIN: {
    SKILLS: "skills",
    RECENT_UPLOADS: "recent-uploads",
    PROMPTS: "prompts",
    LOCATIONS: "locations",
    STAGES: "stages",
    JOB_PRIORITIES: "job-priorities",
    POSITIONS: "positions",
    CRITERIA: "criteria",
    DEPARTMENTS: "departments",
    AUDIT_LOGS: "audit-logs",
    USERS: "users",
    ROLES: "roles",
    DASHBOARD_DATA: "adminDashboardData",
    CLEAR_CACHE: "adminCache",
  },
  CANDIDATES: {
    SEARCH: "candidateSearch",
    JOB_STAGES: "jobStages",
    EVALUATION: "evaluation",
    EVALUATION_HISTORY: "evaluationHistory",
    TRANSCRIPTS: "candidateTranscripts",
    HR_DECISION_HISTORY: "hrDecisionHistory",
    DETAILS: "candidateDetails",
    TIMELINE: "candidateTimeline",
    TRANSCRIPT: "transcript",
  },
  JOBS: {
    STATS: "jobStats",
    LIST: "jobs",
    CANDIDATES: "jobCandidates",
    DETAIL: "job",
    ADMIN_LIST: "adminJobs",
    ADMIN_CANDIDATES: "adminCandidates",
    JOB_VERSION: "jobVersion"
  },
} as const;
