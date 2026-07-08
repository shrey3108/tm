export const INFO = {
  companyName: "August Infotech",
  companyLogo: "src/assets/logo.svg",
  companyDescription: "Hiring Platform is a platform for hiring and managing candidates.",
  copyright: `Copyright © ${new Date().getFullYear()} August Infotech Canada and India. All Rights Reserved`,
} as const;

export const ALLOWED_TRANSCRIPT_FILE_TYPES = [".docx", ".pdf", ".txt"];
export const ALLOWED_TASK_FILE_TYPES = [".docx", ".pdf"];

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


export const UPLOAD_TASK_FILE_TYPES = [".docx", ".pdf"]

export const CHART_COLORS = {
  // HR Decision stats & screening results
  decisions: {
    total: {
      solid: "#60a5fa",
      gradient: ["#93c5fd", "#60a5fa"] as const,
    },
    [HR_DECISION_OPTIONS.PASS]: {
      solid: "#4ade80",
      gradient: ["#86efac", "#4ade80"] as const,
    },
    [HR_DECISION_OPTIONS.MAY_BE]: {
      solid: "#fcd34d",
      gradient: ["#fde68a", "#fcd34d"] as const,
    },
    [HR_DECISION_OPTIONS.FAIL]: {
      solid: "#f87171",
      light: "#fca5a5", // For pie charts or light background
      gradient: ["#fca5a5", "#f87171"] as const,
    },
    [HR_DECISION_OPTIONS.PENDING]: {
      solid: "#a5b4fc",
      gradient: ["#cbd5f5", "#a5b4fc"] as const,
    },
  },

  // AI resume screening results (Pass vs Fail)
  screening: {
    [RESUME_SCREENING_RESULT.PASS]: "#4ade80",
    [RESUME_SCREENING_RESULT.FAIL]: "#fca5a5",
  },

  // Recruitment Stages (multiple gradients)
  stages: [
    ["#ddd6fe", "#c4b5fd"], // soft violet
    ["#c7d2fe", "#a5b4fc"], // soft indigo
    ["#bfdbfe", "#93c5fd"], // soft blue
    ["#a5f3fc", "#67e8f9"], // soft cyan
    ["#99f6e4", "#5eead4"], // soft teal
    ["#a7f3d0", "#6ee7b7"], // soft emerald
  ] as const,

  // Locations (multiple gradients)
  locations: [
    ["#fed7aa", "#fdba74"], // soft orange
    ["#fde68a", "#fcd34d"], // soft amber
    ["#fef08a", "#fde047"], // soft yellow
    ["#fdba74", "#fb923c"], // peach
    ["#fcd34d", "#fbbf24"], // warm amber
  ] as const,

  // JD and Project Skills criteria
  criteria: {
    jd: {
      solid: "#fdba74",
      gradient: ["#fed7aa", "#fdba74"] as const,
    },
    project: {
      solid: "#a5b4fc",
      gradient: ["#cbd5f5", "#a5b4fc"] as const, // kind of blue color
    },
  },

  // Pipeline stages by job (stacked bar chart HSL values)
  pipeline: [
    "hsl(210, 80%, 85%)", // Soft Blue
    "hsl(150, 60%, 85%)", // Soft Green
    "hsl(280, 65%, 88%)", // Soft Purple
    "hsl(340, 70%, 90%)", // Soft Rose
    "hsl(40, 80%, 85%)",  // Soft Amber
    "hsl(180, 50%, 85%)", // Soft Teal
  ] as const,
} as const;
