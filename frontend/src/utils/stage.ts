/**
 * @module stage
 * Utility functions for evaluating stage configurations and template types in the hiring process workflow.
 */

/**
 * Determines if a stage is a question round (which typically requires task papers assignment).
 * Checks if the stage configuration explicitly includes "question" in the `required_inputs`,
 * or falls back to matching the template name `"Technical Practical Round"`.
 *
 * @param stageConfig - The configuration object for the hiring stage, or null/undefined.
 * @returns `true` if the stage is identified as a question round, otherwise `false`.
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
 * Checks if the stage configuration explicitly includes "transcript" in the `required_inputs`,
 * or falls back to checking that the template name is neither `"Technical Practical Round"` nor `"Resume Screening"`.
 *
 * @param stageConfig - The configuration object for the hiring stage, or null/undefined.
 * @returns `true` if the stage is identified as a transcript round, otherwise `false`.
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
