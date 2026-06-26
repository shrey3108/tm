/**
 * Determines if a stage is a question round (requires task papers assignment).
 */
export function isQuestionStage(stageConfig?: { config?: any; template?: { name: string; config?: any } } | null): boolean {
  if (!stageConfig) return false;
  const config = stageConfig.config || stageConfig.template?.config;
  const templateName = stageConfig.template?.name;
  
  if (config && Array.isArray(config.required_inputs) && config.required_inputs.length > 0) {
    return config.required_inputs.includes("question");
  }
  
  return templateName === "Technical Practical Round";
}

/**
 * Determines if a stage is a transcript evaluation round.
 */
export function isTranscriptStage(stageConfig?: { config?: any; template?: { name: string; config?: any } } | null): boolean {
  if (!stageConfig) return false;
  const config = stageConfig.config || stageConfig.template?.config;
  const templateName = stageConfig.template?.name;
  
  if (config && Array.isArray(config.required_inputs) && config.required_inputs.length > 0) {
    return config.required_inputs.includes("transcript");
  }
  
  return templateName !== "Technical Practical Round" && templateName !== "Resume Screening";
}
