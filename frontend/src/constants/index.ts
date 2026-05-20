export const INFO = {
  companyName: "August Infotech",
  companyLogo: "src/assets/logo.svg",
  companyDescription: "Hiring Platform is a platform for hiring and managing candidates.",
  copyright: `Copyright © ${new Date().getFullYear()} August Infotech Canada and India. All Rights Reserved`,
} as const;

export const ALLOWED_TRANSCRIPT_FILE_TYPES = [".docx", ".pdf", ".txt"];

export const RESUME_SCREENING_RESULT = {
  PASS: "Pass",
  FAIL: "Fail",
} as const;

export const HR_DECISION_OPTIONS = {
  PASS: "Pass",
  MAY_BE: "May Be",
  FAIL: "Fail",
  PENDING: "Pending",
} as const;

export const CROSS_JOB_MATCH = {
  name: "Cross Job Match",
} as const;

export const CHART_TEXTS = {
  hrDecision: {
    label: "HR Decision",
    description: "Shows distribution of HR decisions",
  },
  screeningResults: {
    label: "AI Result",
    description: "Shows pass vs fail outcomes of candidates",
  },
  recruitmentStages: {
    label: "Recruitment Stages",
    description: "Shows candidate distribution across different recruitment stages",
  },
  locations: {
    label: "Locations",
    description: "Shows candidate distribution by location",
  },
  priorityTimeline: {
    label: "Hiring Priority",
    description: "Shows job priority timeline",
  },
} as const;

// Max number of items to display in a dropdown before showing "...and X more"
export const FILTER_DISPLAY_LIMIT = 5;
export const DEFAULT_PASSING_THRESHOLD = 70.0;

// Max number of bars displayed in location bar chart before showing "...and X more"
export const MAX_LOCATION_BAR_CHART_DISPLAY_LIMIT = 7;

export const PRIORITY_TIMELINE_COLOR = [
  { min: 0, max: 50, color: "bg-[#86efac]" },
  { min: 51, max: 75, color: "bg-[#fcd34d]" },
  { min: 76, max: 100, color: "bg-[#f87171]" },
] as const;
