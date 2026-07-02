import { HR_DECISION_OPTIONS, RESUME_SCREENING_RESULT } from "./index";

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
      solid: "#4ade80",
      gradient: ["#86efac", "#4ade80"] as const,
    },
    project: {
      solid: "#fcd34d",
      gradient: ["#fde68a", "#fcd34d"] as const,
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
