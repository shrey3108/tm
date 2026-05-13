import { TRANSCRIPT_ALLOWED_EXTENSIONS } from "@/constants/admin";
import { z } from "zod";

/**
 * Schema for validating transcript file path input.
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

/**
 * Schema for validating only the filename and extension for transcript.
 */
export const TranscriptFileNameSchema = z.object({
    filePath: z.string().trim().min(1, "File name is required").refine((val) => {
        const ext = val.split(".").pop()?.toLowerCase();
        return TRANSCRIPT_ALLOWED_EXTENSIONS.includes(ext || "");
    }, {
        message: `Invalid file format. Allow format ${TRANSCRIPT_ALLOWED_EXTENSIONS.join(", ")}`,
    })
});

export type TranscriptFilePathFormValues = z.infer<typeof TranscriptFilePathSchema>;
export type TranscriptFileNameFormValues = z.infer<typeof TranscriptFileNameSchema>;

/**
 * Schema for validating directory path input.
 */
export const DirectoryPathSchema = z.object({
    path: z.string().trim().min(1, "Path is required").refine((val) => {
        const windowsPathRegex = /^[a-zA-Z]:[\\/].*$/;
        const linuxPathRegex = /^\/.*$/;
        return windowsPathRegex.test(val) || linuxPathRegex.test(val);
    }, {
        message: "Invalid path. Use an absolute path (e.g., C:\\path or /path)",
    })
});

export type DirectoryPathFormValues = z.infer<typeof DirectoryPathSchema>;