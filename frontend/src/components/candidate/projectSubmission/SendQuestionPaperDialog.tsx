import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileQuestion, MailIcon, AlertTriangle } from "lucide-react";
import { useQuestionSetPapers, useCandidateTestPaper } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useAssignTestPaperMutation,
  useSendTestPaperEmailMutation,
  useSendBulkTestPaperEmailMutation,
  useDeleteCandidateTestPaperMutation,
  useDeleteJobDefaultTestPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { useCandidateDetailsQuery } from "@/hooks/queries/candidates";
import type { Job } from "@/types/job";
import { LoadingSpinner } from "@/components/shared";
import type { CandidateTestPaperAssign } from "@/types/taskPaper";
import { AssignedPaperView } from "./sendQuestionPaper/AssignedPaperView";
import { PredefinedPaperForm } from "./sendQuestionPaper/PredefinedPaperForm";
import { RandomizedPaperView } from "./sendQuestionPaper/RandomizedPaperView";
import { CustomPaperForm } from "./sendQuestionPaper/CustomPaperForm";
import { SendQuestionPaperFooter } from "./sendQuestionPaper/SendQuestionPaperFooter";
import { extractErrorMessage } from "@/utils/error";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
interface SendQuestionPaperDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateId?: string;
  job: Job | null;
  onSuccess?: () => void;
  selectedCandidates?: any[];
  allCandidates?: any[];
  emailFilterState?: "sent" | "not_sent" | undefined;
}

type AssignmentMode = "predefined" | "random" | "custom";

export function SendQuestionPaperDialog({
  isOpen,
  onOpenChange,
  candidateName: _candidateName,
  candidateId,
  job,
  onSuccess,
  selectedCandidates,
  emailFilterState,
}: SendQuestionPaperDialogProps) {
  const isBulkMode = selectedCandidates && selectedCandidates.length > 1;

  // Queries
  // In bulk mode with email filter (sent/not_sent), query the first candidate's paper
  // to detect if a default job-level paper is already assigned
  const bulkProbeCandiateId = isBulkMode && emailFilterState
    ? selectedCandidates?.[0]?.id
    : undefined;
  const {
    data: assignedPaper,
    loading: loadingAssigned,
    refetch: refetchAssigned,
  } = useCandidateTestPaper(isBulkMode ? bulkProbeCandiateId : candidateId);
  const { data: candidateDetails } = useCandidateDetailsQuery(
    isBulkMode ? undefined : job?.id,
    isBulkMode ? undefined : candidateId
  );

  const { data: predefinedPapers, loading: loadingPredefined } = useQuestionSetPapers({
    jobId: job?.id,
    positionId: job?.position_id,
    options: { enabled: isOpen && !!job?.id }
  });

  // Mutations
  const assignMutation = useAssignTestPaperMutation();
  const sendEmailMutation = useSendTestPaperEmailMutation();
  const sendBulkEmailMutation = useSendBulkTestPaperEmailMutation();
  const deleteMutation = useDeleteCandidateTestPaperMutation();
  const deleteJobDefaultMutation = useDeleteJobDefaultTestPaperMutation();

  // Local state for assignment configuration
  const [mode, setMode] = useState<AssignmentMode>("predefined");
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [customProjectTask, setCustomProjectTask] = useState<string>("");

  // Bulk mode states
  const [bulkAssignedPaper, setBulkAssignedPaper] = useState<any | null>(null);
  const [_assignedPapersList, setAssignedPapersList] = useState<any[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Consolidated assigned paper
  const finalAssignedPaper = isBulkMode
    ? (bulkAssignedPaper || (emailFilterState ? assignedPaper : null))
    : assignedPaper;

  // Reset custom questions and task description when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCustomQuestions([]);
      setCustomProjectTask("");
      setBulkAssignedPaper(null);
      setAssignedPapersList([]);
    }
  }, [isOpen]);

  // Default to custom if no predefined papers are available
  useEffect(() => {
    if (isOpen && !loadingPredefined && predefinedPapers) {
      if (predefinedPapers.length === 0) {
        setMode("custom");
      } else {
        setMode("predefined");
        setSelectedPaperId(predefinedPapers[0]?.id || "");
      }
    }
  }, [isOpen, loadingPredefined, predefinedPapers]);



  const handleAssign = async () => {
    if (isBulkMode) {
      if (!selectedCandidates || selectedCandidates.length === 0) {
        toast.error("No candidates selected.");
        return;
      }
      const missingEmails = selectedCandidates.filter((c) => !c.email);
      if (missingEmails.length > 0) {
        toast.error(
          `The following candidates are missing an email address: ${missingEmails
            .map((c) => `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown")
            .join(", ")}`
        );
        return;
      }

      if (mode === "predefined" && !selectedPaperId) {
        toast.error("Please select a predefined question set paper template.");
        return;
      } else if (mode === "custom") {
        if (customQuestions.length !== 5) {
          toast.error("Please select exactly 5 questions.");
          return;
        }
        if (!customProjectTask.trim()) {
          toast.error("Please provide a project task description.");
          return;
        }
      }

      try {
        toast.info("Assigning test paper...");
        let payload: CandidateTestPaperAssign = {
          mode,
          job_id: job?.id,
          position_id: job?.position_id,
          source_paper_ids: mode === "random" ? predefinedPapers.map((paper) => paper.id) : []
        };
        if (mode === "predefined") {
          payload.paper_id = selectedPaperId;
        } else if (mode === "custom") {
          payload.questions = customQuestions.map((q) => q.trim());
          payload.project_task = customProjectTask.trim();
        }

        const result = await assignMutation.mutateAsync(payload);
        toast.success("Test paper successfully assigned!");
        setBulkAssignedPaper(result);
        // if (onSuccess) onSuccess();
      } catch (err: any) {
        toast.error(extractErrorMessage(err));
      }
      return;
    }

    try {
      let payload: CandidateTestPaperAssign = {
        mode,
        job_id: job?.id,
        position_id: job?.position_id,
        source_paper_ids: mode === "random" ? predefinedPapers.map((paper) => paper.id) : []
      };

      if (selectedCandidates) {
        if (!candidateId) {
          toast.error("Candidate ID is required to assign a test paper.");
          return;
        }
        payload.candidate_id = candidateId;
      }

      if (mode === "predefined") {
        if (!selectedPaperId) {
          toast.error("Please select a predefined question set paper template.");
          return;
        }
        payload.paper_id = selectedPaperId;
      } else if (mode === "custom") {
        if (customQuestions.length !== 5) {
          toast.error("Please select exactly 5 questions.");
          return;
        }
        if (!customProjectTask.trim()) {
          toast.error("Please provide a project task description.");
          return;
        }
        payload.questions = customQuestions.map((q) => q.trim());
        payload.project_task = customProjectTask.trim();
      }

      toast.info("Assigning test paper...");
      await assignMutation.mutateAsync(payload);
      toast.success(
        selectedCandidates
          ? "Test paper successfully assigned to candidate!"
          : "Default test paper successfully assigned to job!"
      );
      refetchAssigned();
      // if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(extractErrorMessage(err));
    }
  };

  const executeSendEmail = async (force: boolean) => {
    if (isBulkMode) {
      if (!selectedCandidates || selectedCandidates.length === 0) {
        toast.error("No candidates selected.");
        return;
      }

      // Filter selected candidates to only include those in technical round and pending
      const filteredSelected = selectedCandidates.filter((candidate) => {
        const isTechnicalRound =
          candidate.current_stage?.template_name?.toLowerCase().includes("technical") ||
          candidate.current_stage?.template_name?.toLowerCase().includes("practical") ||
          false;
        const isPendingStatus =
          candidate.current_stage?.status === "pending" ||
          candidate.hr_decision === "pending" ||
          candidate.current_stage?.hr_decision === "pending" ||
          false;
        return isTechnicalRound && isPendingStatus;
      });

      if (filteredSelected.length === 0) {
        toast.error("No selected candidates are in Technical Practical Round with pending decision.");
        return;
      }

      const filteredIds = filteredSelected.map((c) => c.id);

      try {
        toast.info(`Sending test paper via bulk email to ${filteredSelected.length} candidates...`);
        await sendBulkEmailMutation.mutateAsync({
          paper_id: finalAssignedPaper.id,
          candidate_ids: filteredIds,
          force,
        });
        toast.success("Successfully sent test paper emails in bulk!");
        onOpenChange(false);
      } catch (err: any) {
        toast.error(extractErrorMessage(err));
      }
      return;
    }

    // Single candidate flow (either selectedCandidates has 1 item, or undefined when opened from detail page)
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
      toast.info("Sending test paper via email...");
      await sendEmailMutation.mutateAsync({
        candidate_email: email,
        paper_id: finalAssignedPaper.id,
        force,
      });
      toast.success(`Successfully sent test paper email to ${email}!`);
      onOpenChange(false);
    } catch (err: any) {
      const message = extractErrorMessage(err);
      toast.error(message);
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
          deleteMutation.mutateAsync(candidate.id)
        );
        await Promise.all(deletePromises);
        toast.success("Assignments removed successfully.");
        setBulkAssignedPaper(null);
        setAssignedPapersList([]);
        if (onSuccess) onSuccess();
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to remove assignments.");
      }
      return;
    }

    try {
      toast.info("Removing assignment...");
      if (assignedPaper && !assignedPaper.candidate_id && job?.id) {
        await deleteJobDefaultMutation.mutateAsync(job.id);
        toast.success("Default test paper removed successfully from job.");
      } else {
        if (!candidateId) return;
        await deleteMutation.mutateAsync(candidateId);
        toast.success("Assignment removed successfully.");
      }
      refetchAssigned();
      // if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to remove assignment.");
    }

  };
  // console.log(finalAssignedPaper);
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px] gap-2">

          {/* Header */}
          <DialogHeader className="p-2.5 pb-1.5 border-b border-muted-foreground/10 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              {selectedCandidates ? (
                <>
                  {finalAssignedPaper ?
                    <>
                      <MailIcon className="h-4 w-4 text-primary" />
                      Send Email to
                    </>
                    :
                    <>
                      <FileQuestion className="h-4 w-4 text-primary" />
                      Assign Question Paper to
                    </>
                  }
                  <span className="text-foreground capitalize">
                    {isBulkMode
                      ? `${selectedCandidates.length} Candidates`
                      : `${selectedCandidates[0]?.first_name || ""} ${selectedCandidates[0]?.last_name || ""}`.trim()}
                  </span>
                </>
              ) : (
                <>
                  {!finalAssignedPaper ?
                    <>
                      <FileQuestion className="h-4 w-4 text-primary" />
                      <span className="text-foreground">Set Default Question Paper for All Candidates</span>
                    </>
                    : <>

                      <MailIcon className="h-4 w-4 text-primary" />
                      Send Email to<span className="text-foreground capitalize">
                        {`${candidateDetails?.first_name || ""} ${candidateDetails?.last_name || ""}`.trim()}
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          ({finalAssignedPaper?.email_sent_count ?? 0})
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{finalAssignedPaper?.email_sent_count ?? 0} times email send to candidate</p>
                        </TooltipContent>
                      </Tooltip>

                    </>}

                </>
              )}
            </DialogTitle>
            {!finalAssignedPaper && predefinedPapers && predefinedPapers.length > 0 && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={mode === "predefined" ? "secondary" : "ghost"}
                  onClick={() => setMode("predefined")}
                  disabled={loadingPredefined}
                  className={`flex-1 rounded-lg font-semibold text-sm ${mode === "predefined" ? "shadow-sm" : "text-muted-foreground"
                    }`}
                >
                  Predefined Paper
                </Button>
                <Button
                  type="button"
                  variant={mode === "random" ? "secondary" : "ghost"}
                  onClick={() => setMode("random")}
                  disabled={loadingPredefined}
                  className={`flex-1 rounded-lg font-semibold text-sm ${mode === "random" ? "shadow-sm" : "text-muted-foreground"
                    }`}
                >
                  Randomized Paper
                </Button>
                <Button
                  type="button"
                  variant={mode === "custom" ? "secondary" : "ghost"}
                  onClick={() => setMode("custom")}
                  className={`flex-1 rounded-lg font-semibold text-sm ${mode === "custom" ? "shadow-sm" : "text-muted-foreground"
                    }`}
                >
                  Custom Paper
                </Button>
              </div>
            )}
          </DialogHeader>

          {/* Content body */}
          <div className="flex-1 overflow-y-auto  min-h-0 p-2">
            {loadingAssigned ? (
              <LoadingSpinner message="Checking candidate's test paper assignment..." />
            ) : finalAssignedPaper ? (
              /* ASSIGNED VIEW */
              <AssignedPaperView
                assignedPaper={finalAssignedPaper}
                onUnassign={handleUnassign}
                isUnassigning={deleteMutation.isPending}
              />
            ) : (
              /* UNASSIGNED VIEW / SELECTION & CREATION SHEET */
              <div className="space-y-1.5 animate-in fade-in duration-300 ">
                {loadingPredefined ? (
                  <LoadingSpinner message="Loading question set templates..." />
                ) : !predefinedPapers || predefinedPapers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-muted-foreground/25 rounded-2xl bg-muted/10 max-w-md mx-auto my-8">
                    <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
                    <h3 className="text-lg font-bold text-foreground">No Predefined Papers Available</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      No predefined question set papers are configured for this job/position. To set one up, please visit the{" "}
                      <Link to="/dashboard/questions-bank" className="font-semibold text-primary underline hover:text-primary/80 transition-colors">
                        Questions Bank
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Predefined Selection */}
                    {mode === "predefined" && (
                      <PredefinedPaperForm
                        predefinedPapers={predefinedPapers || []}
                        selectedPaperId={selectedPaperId}
                        onSelectPaperId={setSelectedPaperId}
                      />
                    )}

                    {/* Randomized Explanation */}
                    {mode === "random" && (
                      <RandomizedPaperView
                        jobTitle={job?.title}
                        positionName={job?.position?.name}
                      />
                    )}

                    {/* Custom Builder Form */}
                    {mode === "custom" && (
                      <CustomPaperForm
                        predefinedPapers={predefinedPapers || []}
                        customQuestions={customQuestions}
                        onCustomQuestionsChange={setCustomQuestions}
                        customProjectTask={customProjectTask}
                        onCustomProjectTaskChange={setCustomProjectTask}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!finalAssignedPaper && !loadingPredefined && (!predefinedPapers || predefinedPapers.length === 0) ? (
            <DialogFooter className="p-3 border-t border-muted-foreground/10 bg-muted/20 shrink-0 gap-2 flex items-center justify-end flex-row">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl font-semibold"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          ) : (
            <SendQuestionPaperFooter
              onCancel={() => onOpenChange(false)}
              hasAssignedPaper={!!finalAssignedPaper}
              mode={mode}
              selectedPaperId={selectedPaperId}
              customQuestions={customQuestions}
              customProjectTask={customProjectTask}
              isAssignPending={assignMutation.isPending}
              isSendEmailPending={sendEmailMutation.isPending}
              isEmailAlreadySent={isEmailAlreadySent}
              onAssign={handleAssign}
              onSendEmail={handleSendEmail}
            />
          )}
        </DialogContent>
      </Dialog>

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
