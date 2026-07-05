import { useState } from "react";
import { Button } from "@/components/ui/button";
import AppPageHeader from "@/components/shared/AppPageHeader";
import type { Job } from "@/types/job";
import { TranscriptUpload } from "./TranscriptUpload";
import { ProjectSubmissionDialog } from "./projectSubmission/ProjectSubmissionDialog";
// import { SendQuestionPaperDialog } from "./projectSubmission/SendQuestionPaperDialog";
import { CandidateTestPaperHistoryDialog } from "./projectSubmission/CandidateTestPaperHistoryDialog";
import { useCandidateTestPaper, useCandidateTestPaperHistory } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { useCandidateAssociateResultsQuery } from "@/hooks/queries/candidates/useCandidateStagesQueries";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";
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
  onResumeClick?: () => void;
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
  stageStatus?: string;
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
  // onResumeClick,
  onSuccess,
  // onPaperChange,
  stageId,
  isUploaded,
  stageName,
  candidateId,
  githubUrl,
  transcriptHistory,
  stageStatus,
}: StageCandidatesHeaderProps) => {
  const navigate = useNavigate();
  const [isProjectSubmissionDialogOpen, setIsProjectSubmissionDialogOpen] = useState(false);
  // const [isSendQuestionPaperDialogOpen, setIsSendQuestionPaperDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const activeJobStage = job?.stages?.find((s) => s.id === stageId || s.template?.name === stageName);

  // Extract requirements
  const requiredInputs: ("transcript" | "resume" | "question" | "github")[] =
    activeJobStage?.config?.required_inputs ||
    activeJobStage?.template?.config?.required_inputs ||
    [];

  const hasConfiguredRequirements = requiredInputs.length > 0;

  const showQuestion = hasConfiguredRequirements
    ? requiredInputs.includes("question")
    : isQuestionStage(activeJobStage);

  const showGithub = hasConfiguredRequirements
    ? requiredInputs.includes("github")
    : isQuestionStage(activeJobStage);

  const showTranscript = hasConfiguredRequirements
    ? requiredInputs.includes("transcript")
    : (stageName !== "Resume Screening" && !isQuestionStage(activeJobStage));

  // const showResume = hasConfiguredRequirements
  //   ? requiredInputs.includes("resume")
  //   : false;

  // const { data: assignedPaper } = useCandidateTestPaper(candidateId, stageId); // TODO: Temporarily disabled, will enable when backend fix the issue
  const { data: assignedPaper } = useCandidateTestPaper(candidateId);
  // console.log(assignedPaper);
  const { data: paperHistory } = useCandidateTestPaperHistory(
    (showQuestion || showGithub) ? candidateId : null,
    stageId
  );
  // const { data: candidateAssignedTaskBlob } = useDownloadCandidateAssignedTaskFile(candidateId);

  const { data: associateResults } = useCandidateAssociateResultsQuery(stageId);
  const totalAssociates = associateResults?.total_associates ?? 0;
  const submittedCount = associateResults?.submitted_count ?? 0;
  const allAssociatesSubmitted = totalAssociates > 0 && submittedCount === totalAssociates;
  const hasMultipleAssignments = paperHistory.length > 1;
  const isTranscriptAdded = !!transcriptHistory && transcriptHistory.length > 0;

  const isGithubUploaded = !!githubUrl &&
    githubUrl.toLowerCase().startsWith("http") &&
    (githubUrl.toLowerCase().includes("github.com") || githubUrl.toLowerCase().includes("gitlab.com"));

  const isGithubRequirementMet = !showGithub || isGithubUploaded;

  const isStageSubmitted = stageStatus === "submitted" || stageStatus === "processing";

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
          {/* 
          {showResume && onResumeClick && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border border-muted-foreground/10 px-4 shrink-0 font-semibold"
              onClick={onResumeClick}
            >
              Resume Analysis
            </Button>
          )} */}

          {showQuestion && (
            <>
              <Button
                variant="outline"
                className="rounded-xl border border-muted-foreground/10 font-semibold text-center h-9"
                onClick={() => {
                  const jobSlug = slugify(job?.title || "");
                  const candSlug = slugify(candidateName || "");
                  const stgSlug = slugify(stageName || "");
                  navigate(`/dashboard/jobs/${jobSlug}/candidates/${candSlug}/stages/${stgSlug}/send-paper`, {
                    state: {
                      job,
                      candidateId,
                      candidateName,
                      stageId
                    }
                  });
                }}
                disabled={isUploaded || !job?.is_active || isGithubUploaded || isStageSubmitted}
              >
                {assignedPaper ?
                  <>
                    Send Email
                    <HoverCard>
                      <HoverCardTrigger delay={100} closeDelay={200}>
                        ({assignedPaper?.email_sent_count ?? 0})
                      </HoverCardTrigger>
                      <HoverCardContent className="w-full p-1 py-2 text-xs rounded-lg">
                        {assignedPaper?.email_sent_count ?? 0} times email send to candidate
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
                        {paperHistory.length} times paper assign to candidate
                      </HoverCardContent>
                    </HoverCard>
                  </span>
                </Button>
              )}
              {/* <SendQuestionPaperDialog
                isOpen={isSendQuestionPaperDialogOpen}
                onOpenChange={setIsSendQuestionPaperDialogOpen}
                candidateName={candidateName || "Candidate"}
                candidateId={candidateId}
                job={job}
                jobStageId={stageId}
                onSuccess={onPaperChange || onSuccess}
              /> */}
              <CandidateTestPaperHistoryDialog
                isOpen={isHistoryDialogOpen}
                onOpenChange={setIsHistoryDialogOpen}
                history={paperHistory}
                candidateName={candidateName}
              />
            </>
          )}

          {showGithub && (
            <>
              <Button
                variant="outline"
                className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-9"
                onClick={() => setIsProjectSubmissionDialogOpen(true)}
                disabled={isUploaded || !job?.is_active || (showQuestion && assignedPaper?.email_sent_count === 0) || isGithubUploaded || isStageSubmitted}
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
            </>
          )}

          {(showQuestion || showGithub) && (
            <Button
              variant="outline"
              className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-9 ml-2"
              onClick={() => {
                const jobSlug = slugify(job?.title || "");
                const candSlug = slugify(candidateName || "");
                const stgSlug = slugify(stageName || "");
                navigate(`/dashboard/jobs/${jobSlug}/candidates/${candSlug}/stages/${stgSlug}/assign-associate`, {
                  state: {
                    job,
                    candidate: {
                      id: candidateId,
                      first_name: candidateName?.split(" ")[0] || "",
                      last_name: candidateName?.split(" ").slice(1).join(" ") || "",
                    }
                  }
                });
              }}
              disabled={!job?.is_active || allAssociatesSubmitted || !!associateResults || !isGithubRequirementMet}
            >
              Assign Associate
            </Button>
          )}

          {showTranscript && (
            <TranscriptUpload
              stageId={stageId}
              className="w-auto m-0 shrink-0"
              job={job!}
              disabled={isUploaded || !job?.is_active || isTranscriptAdded}
              onSuccess={onSuccess}
            />
          )}
        </>
      }
    />
  );
};
