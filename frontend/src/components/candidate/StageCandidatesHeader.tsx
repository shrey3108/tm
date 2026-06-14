import { useState } from "react";
import { Button } from "@/components/ui/button";
import AppPageHeader from "@/components/shared/AppPageHeader";
import type { Job } from "@/types/job";
import { TranscriptUpload } from "./TranscriptUpload";
import { ProjectSubmissionDialog } from "./projectSubmission/ProjectSubmissionDialog";
import { SendQuestionPaperDialog } from "./projectSubmission/SendQuestionPaperDialog";
import { useCandidateTestPaper } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
interface StageCandidatesHeaderProps {
  /** Associated job for the candidate stage view */
  job: Job | null;
  /** Name of the candidate being viewed */
  candidateName?: string;
  /** Callback for back navigation */
  onBack: () => void;
  /** Callback for info button click */
  onInfoClick: () => void;
  /** Whether the transcript upload is disabled */
  isUploaded: boolean;
  /** Callback for successful transcript upload */
  onSuccess: () => void;
  /** Callback for successful paper assignment/change */
  onPaperChange?: () => void;
  /** The ID of the stage */
  stageId: string | undefined;
  stageName: string | undefined;
  candidateId?: string;
  githubUrl?: string | null;
  transcriptHistory: any;
}

/**
 * Header component for candidate stage evaluation pages.
 * Displays job title with back navigation and info button.
 */
export const StageCandidatesHeader = ({
  job,
  candidateName,
  onBack,
  onInfoClick,
  onSuccess,
  onPaperChange,
  stageId,
  isUploaded,
  stageName,
  candidateId,
  githubUrl,
  transcriptHistory
}: StageCandidatesHeaderProps) => {
  const [isProjectSubmissionDialogOpen, setIsProjectSubmissionDialogOpen] = useState(false);
  const [isSendQuestionPaperDialogOpen, setIsSendQuestionPaperDialogOpen] = useState(false);
  const { data: assignedPaper } = useCandidateTestPaper(candidateId);
  // console.log(assignedPaper);

  const isTranscriptAdded = !!transcriptHistory && transcriptHistory.length > 0;

  const isGithubUploaded = !!githubUrl &&
    githubUrl.toLowerCase().startsWith("http") &&
    (githubUrl.toLowerCase().includes("github.com") || githubUrl.toLowerCase().includes("gitlab.com"));


  return (
    <AppPageHeader
      headingClassName="text-lg sm:text-xl capitalize"
      title={candidateName ? `${candidateName}` : (job?.title || "Loading...")}
      backAction={{ label: "Back to Candidates", onClick: onBack }}
      meta={
        <div className="flex items-center gap-2">
          {candidateName && <span className="font-semibold text-muted-foreground capitalize text-base">{job?.title}</span>}
          {candidateName && <span className="text-muted-foreground">•</span>}
          <span className="font-semibold text-blue-500 capitalize text-base">
            {job?.department_name || "Department"}
          </span>
        </div>
      }
      breadcrumbActions={
        <>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-xl border border-muted-foreground/10 px-4 shrink-0 font-semibold"
            onClick={onInfoClick}
          >
            JD
          </Button>

          {stageName !== "Resume Screening" && (
            stageName === "Technical Practical Round" ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl border border-muted-foreground/10 font-semibold text-center h-9"
                  onClick={() => setIsSendQuestionPaperDialogOpen(true)}
                  disabled={isUploaded || !job?.is_active || isGithubUploaded}
                >
                  {assignedPaper ?
                    <>

                      Send Email
                      <Tooltip>
                        <TooltipTrigger>
                          ({assignedPaper?.email_sent_count ?? 0})
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{assignedPaper?.email_sent_count ?? 0} times email send to candidate</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                    : "Assign Question Paper"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-9"
                  onClick={() => setIsProjectSubmissionDialogOpen(true)}
                  disabled={isUploaded || !job?.is_active || assignedPaper?.email_sent_count === 0 || isGithubUploaded}
                >
                  Project Submission
                </Button>
                <ProjectSubmissionDialog
                  isOpen={isProjectSubmissionDialogOpen}
                  onOpenChange={setIsProjectSubmissionDialogOpen}
                  candidateName={candidateName || "Candidate"}
                  candidateId={candidateId}
                  stageId={stageId}
                  onSuccess={onSuccess}
                  job={job!}
                />
                <SendQuestionPaperDialog
                  isOpen={isSendQuestionPaperDialogOpen}
                  onOpenChange={setIsSendQuestionPaperDialogOpen}
                  candidateName={candidateName || "Candidate"}
                  candidateId={candidateId}
                  job={job}
                  onSuccess={onPaperChange || onSuccess}
                />
              </>
            ) : (
              <TranscriptUpload
                stageId={stageId}
                className="w-auto m-0 shrink-0"
                job={job!}
                disabled={isUploaded || !job?.is_active || isTranscriptAdded}
                onSuccess={onSuccess}
              />
            )
          )}
        </>
      }
    />
  );
};


