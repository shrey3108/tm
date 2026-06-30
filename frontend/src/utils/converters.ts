/**
 * @module converters
 * Utility functions for data conversion and formatting, such as file sizes.
 */

/**
 * Supported units for file size formatting.
 * - `"Auto"`: Automatically selects the most appropriate unit (B, KB, MB) based on size.
 * - `"B"`: Bytes.
 * - `"KB"`: Kilobytes.
 * - `"MB"`: Megabytes.
 */
export type FileSizeUnit = "Auto" | "B" | "KB" | "MB";

/**
 * Formats a size in bytes into a human-readable string representation based on the target unit.
 *
 * @param bytes - The file size in bytes. Must be a non-negative number.
 * @param unit - The target file size unit to format to, or "Auto" for dynamic formatting.
 * @returns The formatted file size string (e.g., "12.34 KB").
 * @example
 * ```ts
 * formatFileSize(1048576, "MB") // returns "1.00 MB"
 * formatFileSize(1500, "Auto") // returns "1.46 KB"
 * ```
 */
export const formatFileSize = (bytes: number, unit: FileSizeUnit) => {
    if (!bytes || bytes === 0) return "0 B";

    if (unit === "Auto") {
        const units = ["B", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
    }

    const units = { B: 1, KB: 1024, MB: 1024 * 1024 };
    return `${(bytes / units[unit]).toFixed(2)} ${unit}`;
};