import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { useQuestionSetPapers, useCandidateTestPaper } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { useAssignTestPaperMutation, useSendTestPaperEmailMutation, useDeleteCandidateTestPaperMutation } from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { useCandidateDetailsQuery } from "@/hooks/queries/candidates";
import type { Job } from "@/types/job";
import { LoadingSpinner } from "@/components/shared";
import type { CandidateTestPaperAssign } from "@/types/taskPaper";

import { AssignedPaperView } from "./sendQuestionPaper/AssignedPaperView";
import { PredefinedPaperForm } from "./sendQuestionPaper/PredefinedPaperForm";
import { RandomizedPaperView } from "./sendQuestionPaper/RandomizedPaperView";
import { CustomPaperForm } from "./sendQuestionPaper/CustomPaperForm";
import { SendQuestionPaperFooter } from "./sendQuestionPaper/SendQuestionPaperFooter";

interface SendQuestionPaperDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateId?: string;
  job: Job | null;
  onSuccess?: () => void;
  selectedCandidates?: any[];
}

type AssignmentMode = "predefined" | "random" | "custom";

export function SendQuestionPaperDialog({
  isOpen,
  onOpenChange,
  candidateName,
  candidateId,
  job,
  onSuccess,
  selectedCandidates,
}: SendQuestionPaperDialogProps) {
  const isBulkMode = selectedCandidates && selectedCandidates.length > 1;

  // Queries
  const {
    data: assignedPaper,
    loading: loadingAssigned,
    refetch: refetchAssigned,
  } = useCandidateTestPaper(isBulkMode ? undefined : candidateId);

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
  const deleteMutation = useDeleteCandidateTestPaperMutation();

  // Local state for assignment configuration
  const [mode, setMode] = useState<AssignmentMode>("predefined");
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [customProjectTask, setCustomProjectTask] = useState<string>("");

  // Bulk mode states
  const [bulkAssignedPaper, setBulkAssignedPaper] = useState<any | null>(null);
  const [assignedPapersList, setAssignedPapersList] = useState<any[]>([]);

  // Consolidated assigned paper
  const finalAssignedPaper = isBulkMode ? bulkAssignedPaper : assignedPaper;

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
        toast.info(`Assigning test paper to ${selectedCandidates.length} candidates...`);
        const assignPromises = selectedCandidates.map(async (candidate) => {
          let payload: CandidateTestPaperAssign = {
            candidate_id: candidate.id,
            mode,
          };
          if (mode === "predefined") {
            payload.paper_id = selectedPaperId;
          } else if (mode === "custom") {
            payload.questions = customQuestions.map((q) => q.trim());
            payload.project_task = customProjectTask.trim();
          }
          return await assignMutation.mutateAsync(payload);
        });

        const results = await Promise.all(assignPromises);
        toast.success("Test paper successfully assigned to all candidates!");
        if (results.length > 0) {
          setBulkAssignedPaper(results[0]);
          setAssignedPapersList(results);
        }
        if (onSuccess) onSuccess();
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to assign test papers.");
      }
      return;
    }

    try {
      if (!candidateId) {
        toast.error("Candidate ID is required to assign a test paper.");
        return;
      }

      let payload: CandidateTestPaperAssign = {
        candidate_id: candidateId,
        mode,
      };

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
      toast.success("Test paper successfully assigned to candidate!");
      refetchAssigned();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to assign test paper.");
    }
  };

  const handleSendEmail = async () => {
    if (isBulkMode) {
      if (!selectedCandidates || selectedCandidates.length === 0) {
        toast.error("No candidates selected.");
        return;
      }

      try {
        toast.info(`Sending test paper via email to ${selectedCandidates.length} candidates...`);
        const sendPromises = selectedCandidates.map(async (candidate) => {
          const matchedPaper = assignedPapersList.find((paper) => paper.candidate_id === candidate.id);
          const paperId = matchedPaper?.id;
          const email = candidate.email;
          if (paperId && email) {
            return await sendEmailMutation.mutateAsync({
              candidate_email: email,
              paper_id: paperId,
            });
          }
        });

        await Promise.all(sendPromises);
        toast.success(`Successfully sent test paper emails to all candidates!`);
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to send emails.");
      }
      return;
    }

    const email = candidateDetails?.email;
    if (!email) {
      toast.error("Candidate email is missing.");
      return;
    }
    if (!assignedPaper?.id) {
      toast.error("No assigned paper found to send.");
      return;
    }

    try {
      toast.info("Sending test paper via email...");
      await sendEmailMutation.mutateAsync({
        candidate_email: email,
        paper_id: assignedPaper.id,
      });
      toast.success(`Successfully sent test paper email to ${email}!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to send email.");
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

    if (!candidateId) return;

    try {
      toast.info("Removing assignment...");
      await deleteMutation.mutateAsync(candidateId);
      toast.success("Assignment removed successfully.");
      refetchAssigned();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to remove assignment.");
    }

  };

  // const selectedPredefinedPaper = predefinedPapers?.find((p) => p.id === selectedPaperId);
  console.log('selectedCandidates', selectedCandidates);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px] gap-2">

        {/* Header */}
        <DialogHeader className="p-2.5 pb-1.5 border-b border-muted-foreground/10 shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-primary" />
            {/* Send Question Paper */}
            {finalAssignedPaper
              ? `Send Question Paper to `
              : `Send Question Paper to`}
            <span className=" text-foreground capitalize">
              {isBulkMode ? `${selectedCandidates.length} Candidates` : selectedCandidates && selectedCandidates?.length > 0 ? `${selectedCandidates?.map((c) => c.first_name).join(", ")}` : candidateName}
            </span>
          </DialogTitle>
          {/* <DialogDescription className="text-muted-foreground text-sm">
            {assignedPaper
              ? `Review the assigned question set and send email notification to `
              : `Configure and assign a question paper for `}
            <span className="font-semibold text-foreground capitalize">{candidateName}</span>.
          </DialogDescription> */}
        </DialogHeader>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-0.5 min-h-0">
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
            <div className="space-y-1.5 animate-in fade-in duration-300">
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-muted p-1 border border-border/20 shrink-0">
                <Button
                  type="button"
                  variant={mode === "predefined" ? "secondary" : "ghost"}
                  onClick={() => setMode("predefined")}
                  disabled={loadingPredefined || !predefinedPapers || predefinedPapers.length === 0}
                  className={`flex-1 rounded-lg  font-semibold text-sm ${mode === "predefined" ? "shadow-xs" : "text-muted-foreground"
                    }`}
                >
                  Predefined Paper
                </Button>
                <Button
                  type="button"
                  variant={mode === "random" ? "secondary" : "ghost"}
                  onClick={() => setMode("random")}
                  disabled={loadingPredefined || !predefinedPapers || predefinedPapers.length === 0}
                  className={`flex-1 rounded-lg  font-semibold text-sm ${mode === "random" ? "shadow-xs" : "text-muted-foreground"
                    }`}
                >
                  Randomized Paper
                </Button>
                <Button
                  type="button"
                  variant={mode === "custom" ? "secondary" : "ghost"}
                  onClick={() => setMode("custom")}
                  className={`flex-1 rounded-lg font-semibold text-sm ${mode === "custom" ? "shadow-xs" : "text-muted-foreground"
                    }`}
                >
                  Custom Paper
                </Button>
              </div>

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
            </div>
          )}
        </div>

        {/* Footer actions */}
        <SendQuestionPaperFooter
          onCancel={() => onOpenChange(false)}
          hasAssignedPaper={!!finalAssignedPaper}
          mode={mode}
          selectedPaperId={selectedPaperId}
          customQuestions={customQuestions}
          customProjectTask={customProjectTask}
          isAssignPending={assignMutation.isPending}
          isSendEmailPending={sendEmailMutation.isPending}
          onAssign={handleAssign}
          onSendEmail={handleSendEmail}
        />
      </DialogContent>
    </Dialog>
  );
}
