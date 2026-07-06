import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import AppPageHeader from "@/components/shared/AppPageHeader";
import PermissionGuard from "@/components/auth/PermissionGuard";
import type { Job } from "@/types/job";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { BarChart3, Upload, Users } from "lucide-react";
import { JobStatus } from "@/components/shared/JobStatus";
import { useJobAssignedTask } from "@/hooks/queries/jobs/useJobTask";

interface JobCandidatesHeaderProps {
  job: Job | null;
  onBack: () => void;
  onInfoClick: () => void;
  onUploadClick: () => void;
  isUploading: boolean;
  onToggleStatus: () => void;
  jdVersion?: number;
  setJdVersion: (version: number | undefined) => void;
  viewMode: "candidates" | "analytics";
  setViewMode: (viewMode: "candidates" | "analytics") => void;
  showSendQuestionPaper?: boolean;
  onSendQuestionPaperClick?: () => void;
  isSendQuestionPaperDisabled?: boolean;
  emailFilterState?: "sent" | "not_sent" | undefined;
}

export const JobCandidatesHeader = ({
  job,
  onBack,
  onInfoClick,
  onUploadClick,
  isUploading,
  onToggleStatus,
  viewMode,
  setViewMode,
  showSendQuestionPaper = false,
  onSendQuestionPaperClick,
  // isSendQuestionPaperDisabled = true,
  emailFilterState,
}: JobCandidatesHeaderProps) => {
  const { data: jobAssignedPaper } = useJobAssignedTask(job?.id);

  const buttonLabel = useMemo(() => {
    if (emailFilterState === "sent") return "Re-Send Question Paper";
    if (emailFilterState === "not_sent") return "Send Question Paper";
    return jobAssignedPaper ? "View Question Paper" : "Assign Question Paper";
  }, [emailFilterState, jobAssignedPaper]);

  const disabledTooltip = useMemo(() => {
    if (!job?.is_active) return "This action is disabled for inactive jobs";
    return undefined;
  }, [job?.is_active]);

  return (
    <AppPageHeader
      title={job?.title || "Loading..."}
      headingClassName="text-lg sm:text-xl capitalize"
      backAction={{ label: "Back to Jobs", onClick: onBack }}
      meta={
        <>
          <span className="font-semibold text-blue-500 capitalize text-base">{job?.department_name || "Department"}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Job Status:</span>
            {job ? (
              <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                <div className="flex items-center gap-2">
                  <JobStatus job={job} onToggleStatus={onToggleStatus} />
                </div>
              </PermissionGuard>
            ) : null}
          </div>
          {job?.version != null ? (
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            >
              v{job.processing_version ? job.processing_version : job.version}
            </Badge>
          ) : null}

        </>

      }
      breadcrumbActions={
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl shrink-0 font-medium"
            onClick={onSendQuestionPaperClick}
            disabled={!showSendQuestionPaper || !job?.is_active}
            title={disabledTooltip}
          >
            {buttonLabel}
          </Button>
          <div className="bg-muted/50 p-1 rounded-lg flex items-center border border-border shrink-0 h-9">
            <button
              onClick={() => setViewMode("candidates")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                viewMode === "candidates"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-4 w-4" />
              Candidates
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                viewMode === "analytics"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-xl border border-muted-foreground/10 px-4 shrink-0"
            onClick={onInfoClick}
          >
            JD
          </Button>
          <PermissionGuard permissions={PERMISSIONS.CANDIDATES_ACCESS} hideWhenDenied>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl shrink-0 font-medium"
              onClick={onUploadClick}
              disabled={isUploading || !job?.is_active}
              title={!job?.is_active ? "Resume upload is disabled for inactive jobs" : undefined}
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? "Uploading..." : "Upload Resumes"}
            </Button>
          </PermissionGuard>
        </>
      }
    />
  );
};
