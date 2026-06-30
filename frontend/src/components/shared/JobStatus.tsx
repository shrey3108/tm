import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { Job } from "@/types/job";
import { cn } from "@/lib/utils";

interface JobStatusProps {
    /* Job object  */
    job: Job;
    /* Callback to toggle job status */
    onToggleStatus: () => void
}

/**
 * Job Status Component
 * @param {Job} job - Job object {@link Job}
 * @param onToggleStatus Callback to toggle job status
 * @returns Job Status Component
 */
export const JobStatus = ({ job, onToggleStatus }: JobStatusProps) => {
    return (
        <>
            <Switch
                checked={job.is_active}
                onCheckedChange={onToggleStatus}
                id={`status-${job.id}`}
                size="sm"
            />
            <Label
                htmlFor={`status-${job.id}`}
                className={cn(
                    "cursor-pointer text-sm font-medium transition-colors",
                    job.is_active ? "text-primary" : "text-muted-foreground",
                )}
            >
                {job.is_active ? "Open" : "Closed"}
            </Label>
        </>
    )
}