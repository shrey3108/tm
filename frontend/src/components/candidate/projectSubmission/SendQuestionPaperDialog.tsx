import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileQuestion, MailIcon, AlertTriangle, Loader2 } from "lucide-react";
import { useCandidateTestPaper } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { useJobAssignedTask } from "@/hooks/queries/jobs/useJobTask";
import {
  useSendTestPaperEmailMutation,
  useSendBulkTestPaperEmailMutation,
  useDeleteCandidateTestPaperMutation,
  useDeleteJobDefaultTestPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { useCandidateDetailsQuery } from "@/hooks/queries/candidates";
import type { Job } from "@/types/job";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { AssignedPaperView } from "./sendQuestionPaper/AssignedPaperView";
import { extractErrorMessage } from "@/utils/error";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { hasPermissions, PERMISSIONS } from "@/lib/permissions";
import { useQueryClient } from "@tanstack/react-query";
import { slugify } from "@/utils/slug";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface SendQuestionPaperDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateId?: string;
  job: Job | null;
  jobStageId?: string;
  onSuccess?: () => void;
  selectedCandidates?: any[];
  allCandidates?: any[];
  emailFilterState?: "sent" | "not_sent" | undefined;
}

export function SendQuestionPaperDialog({
  isOpen,
  onOpenChange,
  candidateName: _candidateName,
  candidateId,
  job,
  jobStageId,
  onSuccess,
  selectedCandidates,
  emailFilterState,
}: SendQuestionPaperDialogProps) {
  const navigate = useNavigate();
  const isBulkMode = selectedCandidates && selectedCandidates.length > 1;
  const queryClient = useQueryClient();

  // Queries
  const bulkProbeCandiateId = isBulkMode && emailFilterState
    ? selectedCandidates?.[0]?.id
    : undefined;

  const {
    data: candidateAssignedPaper,
    loading: loadingCandidateAssigned,
    refetch: refetchCandidateAssigned,
  } = useCandidateTestPaper(
    isBulkMode
      ? bulkProbeCandiateId
      : (candidateId ? candidateId : undefined),
    jobStageId
  );

  const {
    data: jobAssignedPaper,
    loading: loadingJobAssigned,
    refetch: refetchJobAssigned,
  } = useJobAssignedTask(
    !candidateId && !isBulkMode ? job?.id : undefined,
    jobStageId
  );

  const { data: candidateDetails } = useCandidateDetailsQuery(
    isBulkMode ? undefined : job?.id,
    isBulkMode ? undefined : candidateId
  );

  const assignedPaper = useMemo(() => {
    if (!candidateId && !isBulkMode) {
      return jobAssignedPaper;
    }
    return candidateAssignedPaper;
  }, [candidateId, isBulkMode, jobAssignedPaper, candidateAssignedPaper]);

  const loadingAssigned = (!candidateId && !isBulkMode) ? loadingJobAssigned : loadingCandidateAssigned;

  const finalAssignedPaper = assignedPaper;

  const refetchAssigned = () => {
    if (!candidateId && !isBulkMode) {
      refetchJobAssigned();
    } else {
      refetchCandidateAssigned();
    }
  };

  const currentUser = useAppSelector(selectCurrentUser);
  const hasManagePermission = hasPermissions(currentUser?.permissions, PERMISSIONS.QUESTIONS_MANAGE);

  // Mutations
  const sendEmailMutation = useSendTestPaperEmailMutation();
  const sendBulkEmailMutation = useSendBulkTestPaperEmailMutation();
  const deleteMutation = useDeleteCandidateTestPaperMutation();
  const deleteJobDefaultMutation = useDeleteJobDefaultTestPaperMutation();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const canSendEmail = useMemo(() => {
    if (isBulkMode && selectedCandidates) {
      return selectedCandidates.some((candidate) => {
        const isTechnicalRound =
          candidate.current_stage?.required_inputs?.includes("question") ||
          candidate.current_stage?.required_inputs?.includes("github") ||
          false;
        const isPendingStatus =
          candidate.current_stage?.status === "pending" ||
          candidate.hr_decision === "pending" ||
          candidate.current_stage?.hr_decision === "pending" ||
          false;
        return isTechnicalRound && isPendingStatus;
      });
    }

    const candidate = selectedCandidates && selectedCandidates.length === 1
      ? selectedCandidates[0]
      : candidateDetails;

    if (!candidate) return false;

    const isTechnicalRound =
      candidate.current_stage?.required_inputs?.includes("question") ||
      candidate.current_stage?.required_inputs?.includes("github") ||
      false;
    const isPendingStatus =
      candidate.current_stage?.status === "pending" ||
      candidate.hr_decision === "pending" ||
      candidate.current_stage?.hr_decision === "pending" ||
      false;

    return isTechnicalRound && isPendingStatus;
  }, [isBulkMode, selectedCandidates, candidateDetails]);

  const executeSendEmail = async (force: boolean) => {
    if (!finalAssignedPaper?.id) {
      toast.error("No assigned paper found to send.");
      return;
    }

    if (isBulkMode) {
      if (!selectedCandidates || selectedCandidates.length === 0) {
        toast.error("No candidates selected.");
        return;
      }

      const filteredSelected = selectedCandidates.filter((candidate) => {
        const isTechnicalRound =
          candidate.current_stage?.required_inputs?.includes("question") ||
          candidate.current_stage?.required_inputs?.includes("github") ||
          false;
        const isPendingStatus =
          candidate.current_stage?.status === "pending" ||
          candidate.hr_decision === "pending" ||
          candidate.current_stage?.hr_decision === "pending" ||
          false;
        return isTechnicalRound && isPendingStatus;
      });

      if (filteredSelected.length === 0) {
        toast.error("No selected candidates are in Coding Test / Technical Practical Round with pending decision.");
        return;
      }

      const filteredIds = filteredSelected.map((c) => c.id);

      try {
        toast.info(`Sending question paper via bulk email to ${filteredSelected.length} candidates...`);
        await sendBulkEmailMutation.mutateAsync({
          paper_id: finalAssignedPaper.id,
          candidate_ids: filteredIds,
          force,
        });
        toast.success("Successfully sent question paper emails in bulk!");
        onOpenChange(false);
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err));
      }
      return;
    }

    const email = selectedCandidates && selectedCandidates.length === 1
      ? selectedCandidates[0].email
      : candidateDetails?.email;

    if (!email) {
      toast.error("Candidate email is missing.");
      return;
    }
    if (!finalAssignedPaper?.id) {
      toast.error("No assigned paper found to send.");
      return;
    }

    try {
      toast.info("Sending question paper via email...");
      await sendEmailMutation.mutateAsync({
        candidate_email: email,
        paper_id: finalAssignedPaper.id,
        force,
      });
      toast.success(`Successfully sent question paper email to ${email}!`);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err));
    }
  };

  const isEmailAlreadySent = finalAssignedPaper && finalAssignedPaper.email_sent_count && finalAssignedPaper.email_sent_count > 0;
  const handleSendEmail = async () => {
    if (isEmailAlreadySent) {
      setIsConfirmOpen(true);
    } else {
      await executeSendEmail(false);
    }
  };

  const handleUnassign = async () => {
    if (isBulkMode) {
      if (!selectedCandidates || selectedCandidates.length === 0) return;
      try {
        toast.info("Removing assignments...");
        const deletePromises = selectedCandidates.map((candidate) =>
          deleteMutation.mutateAsync({ candidateId: candidate.id, jobStageId })
        );
        await Promise.all(deletePromises);
        toast.success("Assignments removed successfully.");
        if (onSuccess) onSuccess();
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err, "Failed to remove assignments."));
      }
      return;
    }

    try {
      toast.info("Removing assignment...");
      if (job?.id) {
        await deleteJobDefaultMutation.mutateAsync({ jobId: job.id, jobStageId });
        toast.success("Default question paper removed successfully from job.");
        queryClient.clear();
      }
      refetchAssigned();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to remove assignment."));
    }
  };

  const resolvedCandidateName = useMemo(() => {
    if (selectedCandidates && selectedCandidates.length === 1) {
      return `${selectedCandidates[0]?.first_name || ""} ${selectedCandidates[0]?.last_name || ""}`.trim();
    }
    if (candidateDetails) {
      return `${candidateDetails?.first_name || ""} ${candidateDetails?.last_name || ""}`.trim();
    }
    return _candidateName || "Candidate";
  }, [selectedCandidates, candidateDetails, _candidateName]);

  const titleContent = useMemo(() => {
    const hasPaper = !!finalAssignedPaper;

    if (isBulkMode) {
      return {
        icon: hasPaper ? <MailIcon className="h-4 w-4 text-primary" /> : <FileQuestion className="h-4 w-4 text-primary" />,
        text: hasPaper ? "Send Email to" : "Assign Question Paper to",
        suffix: hasPaper ? `${selectedCandidates.length} Candidates` : "All Candidates",
        hoverCard: null
      };
    }

    const hasCandidate = !!candidateId || (selectedCandidates && selectedCandidates.length === 1);
    if (hasCandidate) {
      return {
        icon: hasPaper ? <MailIcon className="h-4 w-4 text-primary" /> : <FileQuestion className="h-4 w-4 text-primary" />,
        text: hasPaper ? "Send Email to" : "Assign Question Paper to",
        suffix: hasPaper ? resolvedCandidateName : "All Candidates",
        hoverCard: hasPaper && finalAssignedPaper ? (
          <HoverCard>
            <HoverCardTrigger delay={10} closeDelay={10}>
              ({finalAssignedPaper?.email_sent_count ?? 0})
            </HoverCardTrigger>
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
              {finalAssignedPaper?.email_sent_count ?? 0} times email sent to candidate
            </HoverCardContent>
          </HoverCard>
        ) : null
      };
    }

    return {
      icon: <FileQuestion className="h-4 w-4 text-primary" />,
      text: hasPaper ? "View Assigned Paper" : "Set Default Question Paper for All Candidates",
      suffix: "",
      hoverCard: null
    };
  }, [isBulkMode, finalAssignedPaper, selectedCandidates, candidateId, resolvedCandidateName]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[550px] gap-2">

          {/* Header */}
          <DialogHeader className="p-2 pb-1 border-b border-muted-foreground/10 shrink-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              {titleContent.icon}
              <span>{titleContent.text}</span>
              {titleContent.suffix && (
                <span className="text-foreground capitalize">{titleContent.suffix}</span>
              )}
              {titleContent.hoverCard}
            </DialogTitle>
          </DialogHeader>

          {/* Content body */}
          <div className="flex-1 overflow-y-auto min-h-0 p-2">
            {loadingAssigned ? (
              <LoadingSpinner message="Checking candidate's question paper assignment..." />
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300 h-full flex flex-col justify-center">
                {finalAssignedPaper ? (
                  <div className="flex-1 overflow-y-auto">
                    <AssignedPaperView
                      assignedPaper={finalAssignedPaper}
                      onUnassign={handleUnassign}
                      isUnassigning={deleteMutation.isPending}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-muted-foreground/25 rounded-2xl bg-muted/10 max-w-md mx-auto my-8">
                    <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
                    <h3 className="text-lg font-bold text-foreground">No Question Paper Assigned</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      No question paper has been assigned for this job stage yet. You need to assign a paper before you can send it to candidates.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <DialogFooter className="p-2 border-t border-muted-foreground/10 bg-muted/20 shrink-0 gap-3 flex items-center justify-end flex-row">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl font-semibold"
              onClick={() => onOpenChange(false)}
              disabled={sendEmailMutation.isPending || sendBulkEmailMutation.isPending}
            >
              Close
            </Button>

            {finalAssignedPaper ? (
              <>
                {hasManagePermission && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl font-semibold px-4"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/dashboard/jobs/${slugify(job?.title || "")}/assign-paper`);
                    }}
                  >
                    Change Paper
                  </Button>
                )}
                {canSendEmail && (
                  <Button
                    type="button"
                    className="rounded-xl font-semibold"
                    onClick={handleSendEmail}
                    disabled={sendEmailMutation.isPending || sendBulkEmailMutation.isPending}
                  >
                    {sendEmailMutation.isPending || sendBulkEmailMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <MailIcon className="h-4 w-4" />
                        {isEmailAlreadySent ? "Re-Send" : "Send"} to Candidate
                      </>
                    )}
                  </Button>
                )}
              </>
            ) : (
              hasManagePermission && (
                <Button
                  type="button"
                  className="rounded-xl font-semibold"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/dashboard/jobs/${slugify(job?.title || "")}/assign-paper`);
                  }}
                >
                  Assign Question Paper
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog >

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Confirm Re-sending Email</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-2">
              Email has already been sent to this candidate. Are you sure you want to send it again?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={sendEmailMutation.isPending || sendBulkEmailMutation.isPending}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                await executeSendEmail(true);
                setIsConfirmOpen(false);
              }}
              disabled={sendEmailMutation.isPending || sendBulkEmailMutation.isPending}
              className="rounded-xl font-semibold"
            >
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
