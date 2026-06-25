export type FileSizeUnit = "Auto" | "B" | "KB" | "MB";
/**
   * Formats the file size based on the selected unit.
   * @param bytes The size in bytes.
   * @param unit The target unit or 'auto'.
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