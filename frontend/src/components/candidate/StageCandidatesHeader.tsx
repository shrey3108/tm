import { useState } from "react";
import { Button } from "@/components/ui/button";
import AppPageHeader from "@/components/shared/AppPageHeader";
import type { Job } from "@/types/job";
import { TranscriptUpload } from "./TranscriptUpload";
import { ProjectSubmissionDialog } from "./projectSubmission/ProjectSubmissionDialog";
import { SendQuestionPaperDialog } from "./projectSubmission/SendQuestionPaperDialog";
import { CandidateTestPaperHistoryDialog } from "./projectSubmission/CandidateTestPaperHistoryDialog";
import { useCandidateTestPaper, useDownloadCandidateAssignedTaskFile, useCandidateTestPaperHistory } from "@/hooks/queries/taskPapers/useTaskPaperQueries";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { History } from "lucide-react";
import { isQuestionStage } from "@/utils/stage";
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
  /** Whether there is a processing error */
  hasError?: boolean;
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
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const activeJobStage = job?.stages?.find((s) => s.id === stageId || s.template?.name === stageName);
  const isTaskPaperRound = isQuestionStage(activeJobStage);
  const { data: assignedPaper } = useCandidateTestPaper(candidateId, stageId);
  const { data: paperHistory } = useCandidateTestPaperHistory(
    isTaskPaperRound ? candidateId : null,
    stageId
  );
  const { data: candidateAssignedTaskBlob } = useDownloadCandidateAssignedTaskFile(candidateId);
  console.log(candidateAssignedTaskBlob)
  const hasMultipleAssignments = paperHistory.length > 1;
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
            isTaskPaperRound ? (
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
                      <HoverCard>
                        <HoverCardTrigger delay={100} closeDelay={200}>
                          ({assignedPaper?.email_sent_count ?? 0})
                        </HoverCardTrigger>
                        <HoverCardContent className="w-full p-1 py-2 text-xs rounded-lg">
                          <p>{assignedPaper?.email_sent_count ?? 0} times email send to candidate</p>
                        </HoverCardContent>
                      </HoverCard>
                    </>
                    : "Assign Question Paper"}
                </Button>
                {hasMultipleAssignments && (
                  <Button
                    variant="outline"
                    className="rounded-xl border border-muted-foreground/10 font-semibold text-center h-9 gap-1.5"
                    onClick={() => setIsHistoryDialogOpen(true)}
                  >
                    <History className="w-3.5 h-3.5" />
                    Paper History
                    <span className="inline-flex items-center justify-center w-4 h-4 text-xs">
                      <HoverCard>
                        <HoverCardTrigger delay={100} closeDelay={200}>
                          ({paperHistory.length})
                        </HoverCardTrigger>
                        <HoverCardContent className="w-full p-1 py-2 text-xs rounded-lg">
                          <p>{paperHistory.length} times paper assign to candidate</p>
                        </HoverCardContent>
                      </HoverCard>

                    </span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-9"
                  onClick={() => setIsProjectSubmissionDialogOpen(true)}
                  disabled={isUploaded || !job?.is_active || assignedPaper?.email_sent_count === 0 || isGithubUploaded}
                // disabled={isUploaded || !job?.is_active || assignedPaper?.email_sent_count === 0 || isGithubUploaded || hasError}
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
                  jobStageId={stageId}
                  onSuccess={onPaperChange || onSuccess}
                />
                <CandidateTestPaperHistoryDialog
                  isOpen={isHistoryDialogOpen}
                  onOpenChange={setIsHistoryDialogOpen}
                  history={paperHistory}
                  candidateName={candidateName}
                />
              </>
            ) : (
              <TranscriptUpload
                stageId={stageId}
                className="w-auto m-0 shrink-0"
                job={job!}
                // disabled={isUploaded || !job?.is_active || isTranscriptAdded || hasError}
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
