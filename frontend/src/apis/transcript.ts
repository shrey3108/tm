import apiClient from "@/apis/client";
import type {
  Transcript,
  TranscriptUploadResponse,
} from "@/types/transcript";

/**
 * API service for transcript operations.
 * Handles transcript uploads and retrieval.
 */
export const transcriptService = {
  /**
   * Upload a transcript file for a specific candidate stage.
   * @param candidateStageId - UUID of the candidate stage to upload transcript for.
   * @param file - Transcript file (.docx, .pdf, .txt).
   * @returns Upload response with success message and stage ID.
   */
  uploadTranscript: async (
    candidateStageId: string,
    file: File,
  ): Promise<TranscriptUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<TranscriptUploadResponse>(
      `/transcripts/upload/${candidateStageId}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  /**
   * Retrieve a specific transcript by its ID.
   * @param transcriptId - UUID of the transcript.
   * @returns The transcript object.
   */
  getTranscript: async (transcriptId: string): Promise<Transcript> => {
    const response = await apiClient.get<Transcript>(
      `/transcripts/${transcriptId}`,
    );
    return response.data;
  },

  /**
   * Retrieve all transcripts for a specific candidate.
   * @param candidateId - UUID of the candidate.
   * @returns Array of transcript objects.
   */
  getCandidateTranscripts: async (candidateId: string): Promise<Transcript[]> => {
    const response = await apiClient.get<Transcript[]>(
      `/transcripts/candidate/${candidateId}`,
    );
    return response.data;
  },

  /**
   * Delete a transcript and its related data.
   * @param transcriptId - UUID of the transcript to delete.
   * @returns Success message.
   */
  deleteTranscript: async (
    transcriptId: string,
  ): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/transcripts/${transcriptId}`,
    );
    return response.data;
  },
};
