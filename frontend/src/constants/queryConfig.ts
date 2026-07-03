/**
 * Centralized staleTime & gcTime configuration for TanStack Query hooks.
 *
 */


/**
 * Utility function to convert minutes to milliseconds
 * @param m number of minutes
 * @returns number of milliseconds
 */
const minutes = (m: number) => 1000 * 60 * m;

export const QUERY_CONFIG = {
    RECENT_UPLOADS: {
        staleTime: minutes(1),
        gcTime: minutes(2),
    },
    AUDIT_LOGS: {
        staleTime: minutes(1),
        gcTime: minutes(2),
    },
    AI_PROMPTS: {
        staleTime: minutes(5),
    },
    SKILL: {
        staleTime: minutes(5),
    },
    DEPARTMENT: {
        staleTime: minutes(5),
    },
    ASSOCIATE: {
        staleTime: minutes(5),
    },
    GUIDELINE: {
        staleTime: minutes(5),
    },
    LOCATION: {
        staleTime: minutes(5),
    },
    CLEAR_CACHE: {
        staleTime: 0,
        gcTime: 0
    },
    PRIORITY: {
        staleTime: minutes(5),
    },
    JOB_STATUS: {
        staleTime: minutes(5),
    },
    JOB_POSITIONS: {
        staleTime: minutes(5),
    },
    ADMIN_DASHBOARD: {
        staleTime: minutes(1),
    },
    JOB_CRITERIA: {
        staleTime: minutes(1),
    },
    ADMIN_USERS: {
        staleTime: minutes(1),
    },
    ADMIN_ROLES: {
        staleTime: minutes(1),
    },
    ADMIN_ROLE_DETAIL: {
        staleTime: minutes(1),
    },
    ADMIN_PERMISSIONS: {
        staleTime: minutes(1),
    },
    ADMIN_JOBS: {
        staleTime: minutes(1),
    },
    ADMIN_CANDIDATES: {
        staleTime: minutes(1),
    },
    JOB_DETAIL: {
        staleTime: minutes(1),
    },
    JOB_STATS: {
        staleTime: minutes(1),
    },
    JOBS_LIST: {
        staleTime: minutes(1),
    },
    JOB_CANDIDATES_LIST: {
        staleTime: minutes(1),
    },
    SEARCH_JOBS: {
        staleTime: minutes(1),
    },
    TRANSCRIPT_PATH: {
        staleTime: minutes(5),
    },
    CANDIDATE_CROSS_JOB_MATCH: {
        staleTime: minutes(1),
    },
    CANDIDATE_STAGES: {
        staleTime: minutes(1),
    },
    CANDIDATE_TRANSCRIPT: {
        staleTime: minutes(5),
    },
    TASK_PAPER: {
        staleTime: minutes(1),
    },
    AUTH_USER: {
        staleTime: minutes(5),
    },
} as const;
