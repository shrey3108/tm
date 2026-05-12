import { TRANSCRIPT_ALLOWED_EXTENSIONS } from "@/constants/admin";
import { z } from "zod";

/**
 * Schema for validating transcript file path input.
 * 
 * This schema ensures the input is:
 * - A non-empty string
 * - A valid absolute path (either Windows: C:\path or Linux: /path)
 * - Has one of the allowed file extensions: .docx, .txt, .pdf
 */
export const TranscriptFilePathSchema = z.object({
    filePath: z.string().trim().min(1, "Path is required").refine((val) => {
        // Windows absolute path: starts with drive letter (e.g., C:\ or C:/)
        const windowsPathRegex = /^[a-zA-Z]:[\\/].*$/;
        // Linux absolute path: starts with /
        const linuxPathRegex = /^\/.*$/;
        return windowsPathRegex.test(val) || linuxPathRegex.test(val);
    }, {
        message: "Invalid path. Use an absolute path (e.g., C:\\path or /path)",
    }).refine((val) => {
        const ext = val.split(".").pop()?.toLowerCase();
        return TRANSCRIPT_ALLOWED_EXTENSIONS.includes(ext || "");
    }, {
        message: `Invalid file format. Allow format ${TRANSCRIPT_ALLOWED_EXTENSIONS.join(", ")}`,
    })
});

export type TranscriptFilePathFormValues = z.infer<typeof TranscriptFilePathSchema>;