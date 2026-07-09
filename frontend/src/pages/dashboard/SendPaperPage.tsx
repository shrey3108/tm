/**
 * @module SendPaperPage
 * @component SendPaperPage
 *
 * Dashboard page for sending selected test papers to candidates via email or portal links.
 */
import { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileQuestion, MailIcon, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { useCandidateTestPaper } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { useJobAssignedTask } from "@/hooks/queries/jobs/useJobTask";
import {
  useSendTestPaperEmailMutation,
  useSendBulkTestPaperEmailMutation,
  useDeleteCandidateTestPaperMutation,
  useDeleteJobDefaultTestPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { useCandidateDetailsQuery, useResolvedJobAndCandidate } from "@/hooks/queries/candidates/useCandidateStagesQueries";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { AssignedPaperView } from "@/components/candidate/projectSubmission/sendQuestionPaper/AssignedPaperView";
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
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";

export default function SendPaperPage() {
  const params = useParams<{
    jobSlug: string;
    candidateName?: string;
    stageSlug?: string;
    candidateId?: string;
  }>();
  const location = useLocation();
  // console.log(location)
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isReadOnly = !!location.state?.readOnly;

  const stateSelectedCandidates = location.state?.selectedCandidates as any[] | undefined;
  const isBulkMode = !!(stateSelectedCandidates && stateSelectedCandidates.length > 1);

  // Resolved job and candidate from the route params/state
  const { job: resolvedJob, candidate: resolvedCandidate, isLoading: loadingResolution } = useResolvedJobAndCandidate(
    { jobSlug: params.jobSlug, candidateNameSlug: params.candidateName, stateJob: location.state?.job, stateCandidateId: location.state?.candidateId }
  );
  // console.log(resolvedCandidate)
  const job = resolvedJob || location.state?.job || null;

  // Single candidate context resolution
  const singleCandidate = useMemo(() => {
    if (isBulkMode) return null;
    if (stateSelectedCandidates && stateSelectedCandidates.length === 1) {
      return stateSelectedCandidates[0];
    }
    return resolvedCandidate || null;
  }, [isBulkMode, stateSelectedCandidates, resolvedCandidate]);

  const candidateId = singleCandidate?.id || location.state?.candidateId;
  const candidateName = singleCandidate
    ? `${singleCandidate.first_name || ""} ${singleCandidate.last_name || ""}`.trim()
    : (location.state?.candidateName || "");

  const candidateStage = resolvedCandidate?.pipeline?.find(
    (s) => slugify(s.template_name) === params.stageSlug
  );
  const jobStageId = location.state?.stageId || candidateStage?.stage_id;
  const emailFilterState = location.state?.emailFilterState;

  // Queries
  const bulkProbeCandidateId = isBulkMode && emailFilterState
    ? stateSelectedCandidates?.[0]?.id
    : undefined;

  const {
    data: candidateAssignedPaper,
    loading: loadingCandidateAssigned,
    refetch: refetchCandidateAssigned,
  } = useCandidateTestPaper(
    isBulkMode
      ? bulkProbeCandidateId
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
    if (isBulkMode && stateSelectedCandidates) {
      return stateSelectedCandidates.some((candidate) => {
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

    // Single candidate mode: allow sending when a candidate context exists
    return !!candidateId;
  }, [isBulkMode, stateSelectedCandidates, candidateId]);

  const executeSendEmail = async (force: boolean) => {
    if (!finalAssignedPaper?.id) {
      toast.error("No assigned paper found to send.");
      return;
    }

    if (isBulkMode) {
      if (!stateSelectedCandidates || stateSelectedCandidates.length === 0) {
        toast.error("No candidates selected.");
        return;
      }

      const filteredSelected = stateSelectedCandidates.filter((candidate) => {
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
        navigate(-1);
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err));
      }
      return;
    }

    const email = stateSelectedCandidates && stateSelectedCandidates.length === 1
      ? stateSelectedCandidates[0].email
      : (candidateDetails?.email || singleCandidate?.email);

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
      // navigate(-1);
      const jobSlug = slugify(job?.title || "");
      const candSlug = params.candidateName;
      const stgSlug = params.stageSlug;
      navigate(`/dashboard/jobs/${jobSlug}/candidates/${candSlug}/stages/${stgSlug}`, {
        state: { job, candidateId, candidateName, stageId: jobStageId },
      });
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
      if (!stateSelectedCandidates || stateSelectedCandidates.length === 0) return;
      try {
        toast.info("Removing assignments...");
        const deletePromises = stateSelectedCandidates.map((candidate) =>
          deleteMutation.mutateAsync({ candidateId: candidate.id, jobStageId })
        );
        await Promise.all(deletePromises);
        toast.success("Assignments removed successfully.");
        refetchAssigned();
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

  const titleContent = useMemo(() => {
    const hasPaper = !!finalAssignedPaper;

    if (isReadOnly) {
      return {
        icon: <FileQuestion className="h-4 w-4 text-primary" />,
        text: "Assigned Question Paper for",
        suffix: candidateName || "Candidate",
        hoverCard: null
      };
    }

    if (isBulkMode) {
      return {
        icon: hasPaper ? <MailIcon className="h-4 w-4 text-primary" /> : <FileQuestion className="h-4 w-4 text-primary" />,
        text: hasPaper ? "Send Email to" : "Assign Question Paper to",
        suffix: hasPaper ? `${stateSelectedCandidates.length} Candidates` : "All Candidates",
        hoverCard: null
      };
    }

    const hasCandidate = !!candidateId || (stateSelectedCandidates && stateSelectedCandidates.length === 1);
    if (hasCandidate) {
      return {
        icon: hasPaper ? <MailIcon className="h-4 w-4 text-primary" /> : <FileQuestion className="h-4 w-4 text-primary" />,
        text: hasPaper ? "Send Email to" : "Assign Question Paper to",
        suffix: hasPaper ? candidateName : "All Candidates",
        hoverCard: hasPaper && finalAssignedPaper ? (
          <HoverCard>
            <HoverCardTrigger delay={10} closeDelay={10}>
              ({finalAssignedPaper?.email_sent_count ?? 0})
            </HoverCardTrigger>
            <HoverCardContent className="w-fit px-3 py-1 text-xs" side="top">
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
  }, [isBulkMode, finalAssignedPaper, stateSelectedCandidates, candidateId, candidateName, isReadOnly]);

  const isLoading = loadingResolution || loadingAssigned;

  return (
    <AppPageShell width="wide">
      <AppPageHeader
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>{titleContent.text}</span>
            {titleContent.suffix && (
              <span className="font-bold text-foreground capitalize">
                {titleContent.suffix}
              </span>
            )}
            {titleContent.hoverCard}
          </span>
        }
        headingClassName="text-lg sm:text-xl capitalize"
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl border border-muted-foreground/10 px-3 font-semibold gap-1.5"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        }
      />

      <div className="space-y-4">
        {isLoading ? (
          <LoadingSpinner message="Checking assigned paper details..." />
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            {finalAssignedPaper ? (
              <div className="space-y-4">
                <AssignedPaperView
                  assignedPaper={finalAssignedPaper}
                  onUnassign={handleUnassign}
                  isUnassigning={deleteMutation.isPending}
                  readOnly={isReadOnly}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-muted-foreground/25 rounded-2xl bg-muted/10 max-w-md mx-auto my-4">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
                <h3 className="text-base font-bold text-foreground">No Question Paper Assigned</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {isReadOnly
                    ? "No question paper has been assigned to this candidate yet."
                    : "No question paper has been assigned for this job stage yet. You need to assign a paper before you can send it to candidates."}
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 flex-row pt-2 border-t border-muted-foreground/10">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl font-semibold"
                onClick={() => {
                  if (candidateId && params.candidateName && params.stageSlug) {
                    const jobSlug = slugify(job?.title || "");
                    const candSlug = params.candidateName;
                    const stgSlug = params.stageSlug;
                    navigate(`/dashboard/jobs/${jobSlug}/candidates/${candSlug}/stages/${stgSlug}`, {
                      state: { job, candidateId, candidateName, stageId: jobStageId },
                    });
                  }
                }}
                disabled={sendEmailMutation.isPending || sendBulkEmailMutation.isPending}
              >
                Close
              </Button>

              {!isReadOnly && (
                finalAssignedPaper ? (
                  <>
                    {hasManagePermission && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-xl font-semibold px-4"
                        onClick={() => {
                          if (candidateId && params.candidateName && params.stageSlug) {
                            const jobSlug = slugify(job?.title || "");
                            const candSlug = params.candidateName;
                            const stgSlug = params.stageSlug;
                            navigate(`/dashboard/jobs/${jobSlug}/candidates/${candSlug}/stages/${stgSlug}/assign-paper`, {
                              state: { job, candidateId, candidateName, stageId: jobStageId },
                            });
                          } else {
                            navigate(`/dashboard/jobs/${slugify(job?.title || "")}/assign-paper`);
                          }
                        }}
                        disabled={sendEmailMutation.isPending || sendBulkEmailMutation.isPending}
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
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <MailIcon className="h-4 w-4 mr-2" />
                            {isEmailAlreadySent ? "Re-Send" : "Send"} Email to Candidate
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
                        if (candidateId && params.candidateName && params.stageSlug) {
                          const jobSlug = slugify(job?.title || "");
                          const candSlug = params.candidateName;
                          const stgSlug = params.stageSlug;
                          navigate(`/dashboard/jobs/${jobSlug}/candidates/${candSlug}/stages/${stgSlug}/assign-paper`, {
                            state: { job, candidateId, candidateName, stageId: jobStageId },
                          });
                        } else {
                          navigate(`/dashboard/jobs/${slugify(job?.title || "")}/assign-paper`);
                        }
                      }}
                    >
                      Assign Question Paper
                    </Button>
                  )
                )
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl p-4">
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
    </AppPageShell>
  );
}
