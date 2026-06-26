import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileQuestion, MailIcon, AlertTriangle } from "lucide-react";
import {
  useQuestionSetPapers,
  useCandidateTestPaper,
  useAllQuestionsAndTasks
} from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { useJobAssignedTask } from "@/hooks/queries/jobs/useJobTask";
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
import type { CandidateTestPaperAssign, MCQItem } from "@/types/taskPaper";
import { AssignedPaperView } from "./sendQuestionPaper/AssignedPaperView";
import { CustomPaperForm } from "./sendQuestionPaper/CustomPaperForm";
import { SendQuestionPaperFooter } from "./sendQuestionPaper/SendQuestionPaperFooter";
import { extractErrorMessage } from "@/utils/error";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { hasPermissions, PERMISSIONS } from "@/lib/permissions";
import { ManualPaperCreateForm } from "./sendQuestionPaper/ManualPaperCreateForm";
import { useQueryClient } from "@tanstack/react-query";
import { ModeTabBar } from "./sendQuestionPaper/ModeTabBar";
import type { AssignmentMode } from "./sendQuestionPaper/ModeTabBar";
import { AvailableContentSelector } from "./sendQuestionPaper/AvailableContentSelector";

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
  onSuccess?: () => void;
  selectedCandidates?: any[];
  allCandidates?: any[];
  emailFilterState?: "sent" | "not_sent" | undefined;
}

function sampleFromPool<T>(pool: T[], count: number): T[] {
  if (count <= 0 || !pool || pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}

// @ts-ignore
function sampleFromPoolExclude<T>(pool: T[], count: number, exclude: T[], keyFn?: (item: T) => any): T[] {
  if (count <= 0 || !pool || pool.length === 0) return [];
  const excludeKeys = new Set(exclude.map(item => keyFn ? keyFn(item) : item));
  const available = pool.filter(item => {
    const key = keyFn ? keyFn(item) : item;
    return !excludeKeys.has(key);
  });
  return sampleFromPool(available, count);
}

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
  const navigate = useNavigate();
  const isBulkMode = selectedCandidates && selectedCandidates.length > 1;
  const queryClient = useQueryClient();

  // Queries
  // In bulk mode with email filter (sent/not_sent), query the first candidate's paper
  // to detect if a default job-level paper is already assigned
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
      : (candidateId ? candidateId : undefined)
  );

  const {
    data: jobAssignedPaper,
    loading: loadingJobAssigned,
    refetch: refetchJobAssigned,
  } = useJobAssignedTask(
    !candidateId && !isBulkMode ? job?.id : undefined
  );

  const { data: candidateDetails } = useCandidateDetailsQuery(
    isBulkMode ? undefined : job?.id,
    isBulkMode ? undefined : candidateId
  );

  const { data: predefinedPapers, loading: loadingPredefined, refetch: refetchPredefinedPapers } = useQuestionSetPapers({
    jobId: job?.id,
    positionId: job?.position_id,
    options: { enabled: isOpen && !!job?.id }
  });

  const assignedPaper = useMemo(() => {
    if (!candidateId && !isBulkMode) {
      return jobAssignedPaper;
    }
    return candidateAssignedPaper;
  }, [candidateId, isBulkMode, jobAssignedPaper, candidateAssignedPaper]);

  const loadingAssigned = (!candidateId && !isBulkMode) ? loadingJobAssigned : loadingCandidateAssigned;

  // Bulk mode states
  const [bulkAssignedPaper, setBulkAssignedPaper] = useState<any | null>(null);
  const [_assignedPapersList, setAssignedPapersList] = useState<any[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Consolidated assigned paper
  const finalAssignedPaper = isBulkMode
    ? (bulkAssignedPaper || (emailFilterState ? assignedPaper : null))
    : assignedPaper;

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
  const assignMutation = useAssignTestPaperMutation();
  const sendEmailMutation = useSendTestPaperEmailMutation();
  const sendBulkEmailMutation = useSendBulkTestPaperEmailMutation();
  const deleteMutation = useDeleteCandidateTestPaperMutation();
  const deleteJobDefaultMutation = useDeleteJobDefaultTestPaperMutation();

  // Local state for assignment configuration
  const [mode, setMode] = useState<AssignmentMode>("random_extra");
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [customProjectTasks, setCustomProjectTasks] = useState<string[]>([]);
  const [customMcqs, setCustomMcqs] = useState<MCQItem[]>([]);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  // Selected available indices state
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<number[]>([]);
  const [selectedMcqIndices, setSelectedMcqIndices] = useState<number[]>([]);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<number[]>([]);

  // Available content fetching
  const { data: allAvailableContent } = useAllQuestionsAndTasks({
    jobId: job?.id,
    positionId: job?.position_id,
    options: { enabled: isOpen && !!job?.id }
  });

  const [availableQuestions, availableTasks, availableMcqs] = useMemo(() => {
    if (!allAvailableContent) return [[], [], []];
    return [
      allAvailableContent.questions || [], // questions (string[])
      allAvailableContent.project_task || [], // tasks (string[])
      allAvailableContent.mcqs || [], // mcqs (MCQItem[])
    ];
  }, [allAvailableContent]);

  const selectedAvailableQuestions = useMemo(() => {
    return selectedQuestionIndices.map(idx => availableQuestions[idx]).filter(Boolean);
  }, [selectedQuestionIndices, availableQuestions]);

  const selectedAvailableMcqs = useMemo(() => {
    return selectedMcqIndices.map(idx => availableMcqs[idx]).filter(Boolean);
  }, [selectedMcqIndices, availableMcqs]);

  const selectedAvailableTasks = useMemo(() => {
    return selectedTaskIndices.map(idx => availableTasks[idx]).filter(Boolean);
  }, [selectedTaskIndices, availableTasks]);

  const totals = useMemo(() => {
    if (mode === "auto") {
      return {
        questions: finalAssignedPaper?.questions?.length || 0,
        mcqs: finalAssignedPaper?.mcqs?.length || 0,
        tasks: finalAssignedPaper?.project_task?.length || 0,
      };
    }

    const uniqueQ = new Set([...selectedAvailableQuestions, ...customQuestions]).size;

    const mcqMap = new Map<string, MCQItem>();
    selectedAvailableMcqs.forEach(m => mcqMap.set(m.question, m));
    customMcqs.forEach(m => mcqMap.set(m.question, m));
    const uniqueM = mcqMap.size;

    const uniqueT = new Set([...selectedAvailableTasks, ...customProjectTasks]).size;

    return {
      questions: uniqueQ,
      mcqs: uniqueM,
      tasks: uniqueT,
    };
  }, [
    mode,
    finalAssignedPaper,
    selectedAvailableQuestions,
    selectedAvailableMcqs,
    selectedAvailableTasks,
    customQuestions,
    customMcqs,
    customProjectTasks,
  ]);

  const canSendEmail = useMemo(() => {
    if (isBulkMode && selectedCandidates) {
      return selectedCandidates.some((candidate) => {
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
    }

    const candidate = selectedCandidates && selectedCandidates.length === 1
      ? selectedCandidates[0]
      : candidateDetails;

    if (!candidate) return false;

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
  }, [isBulkMode, selectedCandidates, candidateDetails]);

  // Reset custom questions and task description when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCustomQuestions([]);
      setCustomProjectTasks([]);
      setCustomMcqs([]);
      setBulkAssignedPaper(null);
      setAssignedPapersList([]);
      setShowCreateForm(false);
      setSelectedQuestionIndices([]);
      setSelectedMcqIndices([]);
      setSelectedTaskIndices([]);
    }
  }, [isOpen]);

  // Handle default selection when data loads or mode changes
  useEffect(() => {
    if (isOpen && allAvailableContent) {
      if (mode === "random_extra" || mode === "random_custom" || mode === "full_mix") {
        setSelectedQuestionIndices((allAvailableContent.questions || []).map((_, idx) => idx));
        setSelectedMcqIndices((allAvailableContent.mcqs || []).map((_, idx) => idx));
        setSelectedTaskIndices((allAvailableContent.project_task || []).map((_, idx) => idx));
      } else if (mode === "custom" || mode === "custom_extra") {
        setSelectedQuestionIndices([]);
        setSelectedMcqIndices([]);
        setSelectedTaskIndices([]);
      }
    }
  }, [isOpen, mode, allAvailableContent]);

  const handleManualPaperCreated = (newPaper: any) => {
    refetchPredefinedPapers().then(() => {
      setSelectedPaperId(newPaper.id);
      setMode("random_extra");
    });
  };

  // Default mode selection effect
  useEffect(() => {
    if (isOpen && !loadingPredefined && predefinedPapers) {
      const hasEmptyQuestions = predefinedPapers.length > 0 && predefinedPapers.every(
        (paper: any) => !paper.questions || paper.questions.length === 0
      );

      if (hasEmptyQuestions) {
        toast.error("not enough question found");
        const timer = setTimeout(() => {
          onOpenChange(false);
          navigate("/dashboard/questions-bank");
        }, 2000);
        return () => clearTimeout(timer);
      }

      if (finalAssignedPaper) {
        setMode("auto");
      } else if (availableQuestions.length > 0 || availableMcqs.length > 0 || availableTasks.length > 0) {
        setMode("random_extra");
      } else {
        setMode("custom");
      }

      if (predefinedPapers.length > 0) {
        setSelectedPaperId(predefinedPapers[0]?.id || "");
      }
    }
  }, [isOpen, loadingPredefined, predefinedPapers, finalAssignedPaper, availableQuestions.length, availableMcqs.length, availableTasks.length, navigate, onOpenChange]);

  const buildPayload = (): CandidateTestPaperAssign | null => {
    const finalQuestions = Array.from(new Set([...selectedAvailableQuestions, ...customQuestions]));

    const mcqMap = new Map<string, MCQItem>();
    selectedAvailableMcqs.forEach(m => mcqMap.set(m.question, m));
    customMcqs.forEach(m => mcqMap.set(m.question, m));
    const finalMcqs = Array.from(mcqMap.values());

    const finalTasks = Array.from(new Set([...selectedAvailableTasks, ...customProjectTasks]));

    return {
      mode: "custom" as const,
      questions: finalQuestions,
      mcqs: finalMcqs,
      project_task: finalTasks,
    };
  };

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

      if (mode !== "auto") {
        if (totals.questions === 0) {
          toast.error("Please select or add at least 1 question.");
          return;
        }
        if (totals.tasks === 0 && mode !== "random_extra") {
          toast.error("Please select or add at least 1 project task.");
          return;
        }

        const isExtraMode = mode === "random_extra" || mode === "custom_extra" || mode === "full_mix";
        if (isExtraMode) {
          const hasExtra = customQuestions.length > 0 || customProjectTasks.length > 0 || customMcqs.length > 0;
          if (!hasExtra) {
            toast.error("Please add at least one extra Question, MCQ, or Project Task.");
            return;
          }
        }
      }

      try {
        toast.info("Assigning test paper...");
        const partialPayload = buildPayload();
        if (!partialPayload) {
          toast.error("Invalid assignment configuration.");
          return;
        }

        let payload: CandidateTestPaperAssign = {
          ...partialPayload,
          job_id: job?.id,
        };

        const result = await assignMutation.mutateAsync(payload);
        toast.success("Test paper successfully assigned!");
        setBulkAssignedPaper(result);
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err));
      }
      return;
    }

    try {
      if (mode !== "auto") {
        if (totals.questions === 0) {
          toast.error("Please select or add at least 1 question.");
          return;
        }
        if (totals.tasks === 0 && mode !== "random_extra") {
          toast.error("Please select or add at least 1 project task.");
          return;
        }

        const isExtraMode = mode === "random_extra" || mode === "custom_extra" || mode === "full_mix";
        if (isExtraMode) {
          const hasExtra = customQuestions.length > 0 || customProjectTasks.length > 0 || customMcqs.length > 0;
          if (!hasExtra) {
            toast.error("Please add at least one extra Question, MCQ, or Project Task.");
            return;
          }
        }
      }

      const partialPayload = buildPayload();
      if (!partialPayload) {
        toast.error("Invalid assignment configuration.");
        return;
      }

      let payload: CandidateTestPaperAssign = {
        ...partialPayload,
        job_id: job?.id,
      };

      // Even if candidateId is present, we assign the paper to the job (all candidates)
      // so we do NOT set payload.candidate_id. if assign to the specific canidate only then we have to add in payload

      toast.info("Assigning test paper...");
      await assignMutation.mutateAsync(payload);
      toast.success(
        selectedCandidates && selectedCandidates.length > 0
          ? "Test paper successfully assigned to candidate!"
          : "Default test paper successfully assigned to job!"
      );
      refetchAssigned();
    } catch (err: unknown) {
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
      } catch (err: unknown) {
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
          deleteMutation.mutateAsync(candidate.id)
        );
        await Promise.all(deletePromises);
        toast.success("Assignments removed successfully.");
        setBulkAssignedPaper(null);
        setAssignedPapersList([]);
        if (onSuccess) onSuccess();
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err, "Failed to remove assignments."));
      }
      return;
    }

    try {
      toast.info("Removing assignment...");
      if (job?.id) {
        await deleteJobDefaultMutation.mutateAsync(job.id);
        toast.success("Default test paper removed successfully from job.");
        queryClient.clear();
        setMode("custom");
      }
      refetchAssigned();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to remove assignment."));
    }
  };

  const disabledModes = useMemo<AssignmentMode[]>(() => {
    const list: AssignmentMode[] = [];
    if (!finalAssignedPaper) {
      list.push("auto");
    }
    return list;
  }, [finalAssignedPaper]);

  const disabledReasons = useMemo<Record<AssignmentMode, string>>(() => {
    return {
      auto: "No paper has been assigned to this candidate yet.",
    } as Record<AssignmentMode, string>;
  }, []);

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
    const showSendEmail = mode === "auto";

    if (isBulkMode) {
      return {
        icon: showSendEmail ? <MailIcon className="h-4 w-4 text-primary" /> : <FileQuestion className="h-4 w-4 text-primary" />,
        text: showSendEmail ? "Send Email to" : "Assign Question Paper to",
        suffix: showSendEmail ? `${selectedCandidates.length} Candidates` : "All Candidates",
        hoverCard: null
      };
    }

    const hasCandidate = !!candidateId || (selectedCandidates && selectedCandidates.length === 1);
    if (hasCandidate) {
      return {
        icon: showSendEmail ? <MailIcon className="h-4 w-4 text-primary" /> : <FileQuestion className="h-4 w-4 text-primary" />,
        text: showSendEmail ? "Send Email to" : "Assign Question Paper to",
        suffix: showSendEmail ? resolvedCandidateName : "All Candidates",
        hoverCard: showSendEmail && finalAssignedPaper ? (
          <HoverCard>
            <HoverCardTrigger delay={10} closeDelay={10}>
              ({finalAssignedPaper?.email_sent_count ?? 0})
            </HoverCardTrigger>
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
              <p>{finalAssignedPaper?.email_sent_count ?? 0} times email sent to candidate</p>
            </HoverCardContent>
          </HoverCard>
        ) : null
      };
    }

    // Job default mode
    return {
      icon: <FileQuestion className="h-4 w-4 text-primary" />,
      text: showSendEmail ? "View Assigned Paper" : "Set Default Question Paper for All Candidates",
      suffix: "",
      hoverCard: null
    };
  }, [isBulkMode, mode, finalAssignedPaper, selectedCandidates, candidateId, resolvedCandidateName]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px] gap-2">

          {/* Header */}
          <DialogHeader className="p-2.5 pb-1.5 border-b border-muted-foreground/10 shrink-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              {titleContent.icon}
              <span>{titleContent.text}</span>
              {titleContent.suffix && (
                <span className="text-foreground capitalize">{titleContent.suffix}</span>
              )}
              {titleContent.hoverCard}
            </DialogTitle>
            {!loadingPredefined && (
              <ModeTabBar
                mode={mode}
                onModeChange={setMode}
                disabledModes={disabledModes}
                disabledReasons={disabledReasons}
              />
            )}
          </DialogHeader>

          {/* Content body */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4">
            {loadingAssigned ? (
              <LoadingSpinner message="Checking candidate's test paper assignment..." />
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                {mode === "auto" && finalAssignedPaper && (
                  <AssignedPaperView
                    assignedPaper={finalAssignedPaper}
                    onUnassign={handleUnassign}
                    isUnassigning={deleteMutation.isPending}
                  />
                )}

                {mode !== "auto" && (
                  loadingPredefined ? (
                    <LoadingSpinner message="Loading question set templates..." />
                  ) : !predefinedPapers || predefinedPapers.length === 0 ? (
                    hasManagePermission && job?.id && job?.position_id ? (
                      !showCreateForm ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                          <div className="text-center py-4 border border-dashed border-border/60 rounded-2xl bg-card/10 text-muted-foreground max-w-md mx-auto">
                            <p className="font-semibold text-foreground/80">No Question Set Papers Found</p>
                            <p className="text-sm mt-1 max-w-md mx-auto">
                              There are no predefined question set papers for the selected job and experience level.
                              Upload a document to automatically extract questions, or define one manually below!
                            </p>
                          </div>
                          <Button onClick={() => setShowCreateForm(true)}>Add</Button>
                        </div>
                      ) : (
                        <div className="p-1">
                          <ManualPaperCreateForm
                            jobId={job.id}
                            positionId={job.position_id}
                            onSuccess={handleManualPaperCreated}
                            onCancel={() => setShowCreateForm(false)}
                          />
                        </div>
                      )
                    ) : (
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
                    )
                  ) : (
                    <>
                      {/* RENDER MODES */}
                      {/* Available Content Selector (shared across all assignment modes) */}
                      {(mode === "custom" || mode === "custom_extra" || mode === "random_custom" || mode === "full_mix" || mode === "random_extra") && (
                        <AvailableContentSelector
                          availableQuestions={availableQuestions}
                          availableMcqs={availableMcqs}
                          availableTasks={availableTasks}
                          selectedQuestionIndices={selectedQuestionIndices}
                          selectedMcqIndices={selectedMcqIndices}
                          selectedTaskIndices={selectedTaskIndices}
                          onSelectedQuestionIndicesChange={setSelectedQuestionIndices}
                          onSelectedMcqIndicesChange={setSelectedMcqIndices}
                          onSelectedTaskIndicesChange={setSelectedTaskIndices}
                        />
                      )}

                      {/* Custom/Extra Builder Form (shared across all assignment modes) */}
                      {(mode === "custom" || mode === "custom_extra" || mode === "random_custom" || mode === "full_mix" || mode === "random_extra") && (
                        <div className="border border-border/40 rounded-2xl p-4 bg-muted/5">
                          {/* <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                            Custom Selections & Extra Additions
                          </h4> */}
                          <CustomPaperForm
                            customQuestions={customQuestions}
                            onCustomQuestionsChange={setCustomQuestions}
                            customProjectTasks={customProjectTasks}
                            onCustomProjectTasksChange={setCustomProjectTasks}
                            customMcqs={customMcqs}
                            onCustomMcqsChange={setCustomMcqs}
                            hideManualInput={mode === "custom" || mode === "random_custom"}
                          />
                        </div>
                      )}
                    </>
                  )
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!finalAssignedPaper && !loadingPredefined && (!predefinedPapers || predefinedPapers.length === 0) ? (
            !hasManagePermission ? (
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
            ) : null
          ) : (
            <SendQuestionPaperFooter
              onCancel={() => onOpenChange(false)}
              hasAssignedPaper={mode === "auto"}
              mode={mode}
              selectedPaperId={selectedPaperId}
              isAssignPending={assignMutation.isPending}
              isSendEmailPending={sendEmailMutation.isPending}
              isEmailAlreadySent={isEmailAlreadySent}
              canSendEmail={canSendEmail}
              onAssign={handleAssign}
              onSendEmail={handleSendEmail}
              totalQuestions={totals.questions}
              totalMcqs={totals.mcqs}
              totalTasks={totals.tasks}
              hasExtraItems={customQuestions.length > 0 || customProjectTasks.length > 0 || customMcqs.length > 0}
            />
          )}
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

