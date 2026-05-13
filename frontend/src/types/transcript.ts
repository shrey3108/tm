/**
 * Type definitions for interview transcript processing.
 */

/**
 * A single turn in the interview dialogue.
 */
export interface DialogueTurn {
  /** Name of the speaker (e.g., "Interviewer", "Candidate") */
  speaker: string;
  /** Text content of the dialogue turn */
  text: string;
}

/**
 * Structure of the segments field in Transcript.
 */
export interface TranscriptSegments {
  dialogues: DialogueTurn[];
}

/**
 * Represents a single Transcript record.
 * Matches the backend Transcript ORM model.
 */
export interface Transcript {
  id: string;
  interview_id: string;
  file_id: string;
  transcript_text?: string | null;
  segments?: TranscriptSegments | null;
  transcript_hash?: string | null;
  clean_transcript_text?: string | null;
  generated_at: string;
}

/**
 * Response from uploading a transcript.
 */
export interface TranscriptUploadResponse {
  message: string;
  candidate_stage_id: string;
  next_step: string;
}

/**
 * Possible states for transcript processing.
 */
export type TranscriptStatus = "uploaded" | "processing" | "completed" | "failed";

export type TranscriptList = Transcript[];



export interface GetDefaultTranscriptResponse {
  default_path: string,
  source: string
}

export interface UpdateDefaultTranscriptPathResponse {
  message: string;
  new_path: string
}