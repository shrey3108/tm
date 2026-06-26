import type { TaskItem } from "@/types/taskPaper";

/**
 * Formats a sub-task duration in minutes to a readable string (e.g., "1 hour" or "2 minutes" or "1 hour & 2 minutes")
 */
export function formatSubTaskDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  }
  if (mins > 0) {
    parts.push(`${mins} minute${mins !== 1 ? "s" : ""}`);
  }
  return parts.join(" & ") || "0 minutes";
}

/**
 * Formats the total duration in minutes to the main task title format (e.g., "1 Hour & 2 Minutes")
 */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const hourStr = hours > 0 ? `${hours} Hour${hours !== 1 ? "s" : ""}` : "";
  const minStr = minutes > 0 ? `${minutes} Minute${minutes !== 1 ? "s" : ""}` : "";

  if (hourStr && minStr) {
    return `${hourStr} & ${minStr}`;
  }
  return hourStr || minStr || "0 Minutes";
}

/**
 * Formats a project task and all its sub-tasks into a plain-text representation.
 */
export function formatProjectTask(task: string | TaskItem): string {
  if (typeof task === "string") {
    return task;
  }

  const description = task.task || task.description || "";
  const subTasks = task.tasks || [];

  if (subTasks.length === 0) {
    return description;
  }

  const totalMarks = task.total_marks ?? subTasks.reduce((sum, t) => sum + (t.marks || 0), 0);
  const totalDuration = task.duration ?? task.total_duration ?? 0;
  const formattedDuration = formatDuration(totalDuration);

  let result = `Project Task Description : ${description}  total marks ${totalMarks} | ${formattedDuration} (marks and time calculate on based on task)`;

  subTasks.forEach((sub, index) => {
    const subName = sub.name || (sub as any).title || "";
    const subMarks = sub.marks !== undefined ? `${sub.marks} marks` : "";
    const subDesc = sub.description ? ` (${sub.description})` : "";
    result += `\n${index + 1}. ${subName} ${subMarks}${subDesc}`.trim();
  });

  return result;
}
