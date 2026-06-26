import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  BookOpen,
  UserCheck,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from "lucide-react";

import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect, LoadingSpinner, PaperContentDisplay } from "@/components/shared";

import { useJobBySlugOrId } from "@/hooks/queries/jobs/useJob";
import { useJobAssignedTask } from "@/hooks/queries/jobs/useJobTask";
import { useAllQuestionsAndTasks } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useAssignTestPaperMutation,
  useDeleteJobDefaultTestPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { taskService } from "@/apis/task";

import type { MCQItem, TaskItem, SubTaskItem, QuestionItem } from "@/types/taskPaper";
import { mcqFormSchema } from "@/schemas/taskPaper";
import { questionFormSchema, projectTaskSchema } from "@/schemas/admin";

import { SingleQuestionFormFields } from "@/components/questions-bank/SingleQuestionFormFields";
import { MCQFormFields } from "@/components/questions-bank/MCQFormFields";
import { ProjectTaskFormFields } from "@/components/questions-bank/ProjectTaskFormFields";

export default function AssignPaperPage() {
  const navigate = useNavigate();
  const { jobSlug } = useParams<{ jobSlug: string }>();

  // Fetch job detail
  const { data: job, loading: loadingJob } = useJobBySlugOrId(undefined, jobSlug, true);

  // Filter stage rounds that require technical questions
  const questionStages = useMemo(() => {
    if (!job?.stages) return [];
    return job.stages.filter((stage) => {
      const requiredInputs = stage.config?.required_inputs || stage.template?.config?.required_inputs || [];
      return requiredInputs.includes("question") || stage.template?.name === "Technical Practical Round";
    });
  }, [job?.stages]);

  // Selected stage configuration state
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  // Default to the first technical stage once loaded
  useEffect(() => {
    if (questionStages.length > 0 && !selectedStageId) {
      setSelectedStageId(questionStages[0].id);
    }
  }, [questionStages, selectedStageId]);

  // Fetch currently assigned job-level default paper
  const { data: assignedPaper, loading: loadingAssignedPaper, refetch: refetchAssignedPaper } = useJobAssignedTask(
    job?.id,
    selectedStageId || undefined
  );

  // Collapsible toggle states
  const [showCurrentDetails, setShowCurrentDetails] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Fetch random preview questions from the backend
  const { data: randomPreview, isLoading: loadingRandomPreview, refetch: refetchRandomPreview } = useQuery({
    queryKey: ["random-preview", job?.id, selectedStageId],
    queryFn: () => taskService.previewRandomQuestions({ jobId: job!.id, count: 5 }),
    enabled: !!job?.id,
    staleTime: 0,
  });

  // Fetch all question bank content for matching position/department
  const { data: allContent, loading: loadingAllContent } = useAllQuestionsAndTasks({
    jobId: job?.id,
    options: { enabled: !!job?.id },
  });

  // Selection Pools and Custom Added Pools
  const [randomPoolQuestions, setRandomPoolQuestions] = useState<QuestionItem[]>([]);
  const [randomPoolMCQs, setRandomPoolMCQs] = useState<MCQItem[]>([]);
  const [randomPoolTasks, setRandomPoolTasks] = useState<TaskItem[]>([]);

  const [availablePoolQuestions, setAvailablePoolQuestions] = useState<QuestionItem[]>([]);
  const [availablePoolMCQs, setAvailablePoolMCQs] = useState<MCQItem[]>([]);
  const [availablePoolTasks, setAvailablePoolTasks] = useState<TaskItem[]>([]);

  const [selectedQuestions, setSelectedQuestions] = useState<QuestionItem[]>([]);
  const [selectedMCQs, setSelectedMCQs] = useState<MCQItem[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<TaskItem[]>([]);

  const [customQuestions, setCustomQuestions] = useState<QuestionItem[]>([]);
  const [customMCQs, setCustomMCQs] = useState<MCQItem[]>([]);
  const [customTasks, setCustomTasks] = useState<TaskItem[]>([]);

  // Setup pools and default selections from random pool
  useEffect(() => {
    if (!randomPreview) return;
    const normQs = (randomPreview.questions || []).map((q) =>
      typeof q === "string" ? { question: q, marks: 5, duration: 3 } : q
    );
    const normMcqs = randomPreview.mcqs || [];
    const normTasks = (randomPreview.project_task || []).map((t) =>
      typeof t === "string" ? { task: t, description: t, instructions: "", duration: 30, tasks: [] } : t
    );

    setRandomPoolQuestions(normQs);
    setRandomPoolMCQs(normMcqs);
    setRandomPoolTasks(normTasks);

    // Checked by default
    setSelectedQuestions(normQs);
    setSelectedMCQs(normMcqs);
    setSelectedTasks(normTasks);
  }, [randomPreview]);

  // Setup remaining available questions for the available bank pool (filtered to exclude random pool duplicates)
  useEffect(() => {
    if (!allContent || !randomPreview) return;
    const randomQs = (randomPreview.questions || []).map((q) => (typeof q === "string" ? q : q.question));
    const randomMcqs = (randomPreview.mcqs || []).map((m) => m.question);
    const randomTasks = (randomPreview.project_task || []).map((t) =>
      typeof t === "string" ? t : t.task || t.title || ""
    );

    const normQs = (allContent.questions || [])
      .map((q) => (typeof q === "string" ? { question: q, marks: 5, duration: 3 } : q))
      .filter((q) => !randomQs.includes(q.question));

    const normMcqs = (allContent.mcqs || []).filter((m) => !randomMcqs.includes(m.question));

    const normTasks = (allContent.project_task || [])
      .map((t) =>
        typeof t === "string" ? { task: t, description: t, instructions: "", duration: 30, tasks: [] } : t
      )
      .filter((t) => !randomTasks.includes(t.task || t.title || ""));

    setAvailablePoolQuestions(normQs);
    setAvailablePoolMCQs(normMcqs);
    setAvailablePoolTasks(normTasks);
  }, [allContent, randomPreview]);

  // Draft Custom Item states
  const [contentType, setContentType] = useState<"question" | "mcq" | "project_task">("question");

  const [questionText, setQuestionText] = useState<string>("");
  const [questionMarks, setQuestionMarks] = useState<number | "">("");
  const [questionHours, setQuestionHours] = useState<number | "">("");
  const [questionMinutes, setQuestionMinutes] = useState<number | "">("");

  const [mcqQuestion, setMCQQuestion] = useState<string>("");
  const [mcqOptions, setMCQOptions] = useState<string[]>(["", ""]);
  const [mcqAnswer, setMCQAnswer] = useState<string>("");
  const [mcqMarks, setMCqMarks] = useState<number | "">("");
  const [mcqHours, setMCqHours] = useState<number | "">("");
  const [mcqMinutes, setMCqMinutes] = useState<number | "">("");

  const [taskDescription, setTaskDescription] = useState<string>("");
  const [taskInstructions, setTaskInstructions] = useState<string>("");
  const [taskHours, setTaskHours] = useState<number | "">("");
  const [taskMinutes, setTaskMinutes] = useState<number | "">("");
  const [projectTasks, setProjectTasks] = useState<SubTaskItem[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setErrors({});
  }, [contentType, mcqOptions.length]);

  // Toggle checks
  const toggleQuestionSelection = (item: QuestionItem) => {
    setSelectedQuestions((prev) => {
      const exists = prev.some((q) => q.question === item.question);
      if (exists) {
        return prev.filter((q) => q.question !== item.question);
      } else {
        return [...prev, item];
      }
    });
  };

  const toggleMCQSelection = (item: MCQItem) => {
    setSelectedMCQs((prev) => {
      const exists = prev.some((m) => m.question === item.question);
      if (exists) {
        return prev.filter((m) => m.question !== item.question);
      } else {
        return [...prev, item];
      }
    });
  };

  const toggleTaskSelection = (item: TaskItem) => {
    setSelectedTasks((prev) => {
      const key = item.task || item.title || "";
      const exists = prev.some((t) => (t.task || t.title) === key);
      if (exists) {
        return prev.filter((t) => (t.task || t.title) !== key);
      } else {
        return [...prev, item];
      }
    });
  };

  // Add Custom drafts with Zod validation
  const handleAddCustom = () => {
    setErrors({});
    if (contentType === "question") {
      const result = questionFormSchema.safeParse({
        question: questionText,
        marks: questionMarks === "" ? undefined : Number(questionMarks),
        hours: questionHours === "" ? 0 : Number(questionHours),
        minutes: questionMinutes === "" ? 0 : Number(questionMinutes),
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          newErrors[issue.path.join(".")] = issue.message;
        });
        setErrors(newErrors);
        return;
      }

      const newItem: QuestionItem = {
        question: questionText.trim(),
        marks: Number(questionMarks),
        duration: (Number(questionHours) || 0) * 60 + (Number(questionMinutes) || 0),
      };

      setCustomQuestions((prev) => [...prev, newItem]);
      setQuestionText("");
      setQuestionMarks("");
      setQuestionHours("");
      setQuestionMinutes("");
      toast.success("Added custom normal question.");
    } else if (contentType === "mcq") {
      const result = mcqFormSchema.safeParse({
        question: mcqQuestion,
        options: mcqOptions,
        answer: mcqAnswer,
        marks: mcqMarks === "" ? undefined : Number(mcqMarks),
        hours: mcqHours === "" ? 0 : Number(mcqHours),
        minutes: mcqMinutes === "" ? 0 : Number(mcqMinutes),
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          if (issue.path[0] === "options" && typeof issue.path[1] === "number") {
            newErrors[`options.${issue.path[1]}`] = issue.message;
          } else {
            newErrors[issue.path.join(".")] = issue.message;
          }
        });
        setErrors(newErrors);
        return;
      }

      const answerIndex = mcqAnswer.charCodeAt(0) - 65;
      const answerText = mcqOptions[answerIndex] || "";

      const newItem: MCQItem = {
        question: mcqQuestion.trim(),
        options: mcqOptions.map((o) => o.trim()),
        answer: answerText.trim(),
        marks: Number(mcqMarks),
        duration: (Number(mcqHours) || 0) * 60 + (Number(mcqMinutes) || 0),
      };

      setCustomMCQs((prev) => [...prev, newItem]);
      setMCQQuestion("");
      setMCQOptions(["", ""]);
      setMCQAnswer("");
      setMCqMarks("");
      setMCqHours("");
      setMCqMinutes("");
      toast.success("Added custom MCQ question.");
    } else if (contentType === "project_task") {
      const result = projectTaskSchema.safeParse({
        project_task: taskDescription,
        instructions: taskInstructions,
        hours: taskHours,
        minutes: taskMinutes,
        tasks: projectTasks,
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          newErrors[issue.path.join(".")] = issue.message;
        });
        setErrors(newErrors);
        return;
      }

      const duration = (Number(taskHours) || 0) * 60 + (Number(taskMinutes) || 0);

      const newItem: TaskItem = {
        task: taskDescription.trim(),
        instructions: taskInstructions.trim(),
        title: taskDescription.trim(),
        description: taskDescription.trim(),
        duration,
        tasks: projectTasks.map((t) => ({
          name: t.name,
          description: t.description || undefined,
          marks: t.marks,
        })),
        total_marks: projectTasks.reduce((sum, t) => sum + (t.marks || 0), 0),
        total_duration: duration,
      };

      setCustomTasks((prev) => [...prev, newItem]);
      setTaskDescription("");
      setTaskInstructions("");
      setTaskHours("");
      setTaskMinutes("");
      setProjectTasks([]);
      toast.success("Added custom project task.");
    }
  };

  // Mutations
  const assignMutation = useAssignTestPaperMutation();
  const unassignMutation = useDeleteJobDefaultTestPaperMutation();

  const handleAssign = async () => {
    if (!job?.id) return;
    if (!selectedStageId) {
      toast.error("Please select a stage round to assign the paper.");
      return;
    }

    const finalQuestions = [...selectedQuestions, ...customQuestions];
    const finalMCQs = [...selectedMCQs, ...customMCQs];
    const finalTasks = [...selectedTasks, ...customTasks];

    if (finalQuestions.length === 0 && finalMCQs.length === 0 && finalTasks.length === 0) {
      toast.error("Please select or add at least one question or task.");
      return;
    }

    try {
      await assignMutation.mutateAsync({
        job_id: job.id,
        job_stage_id: selectedStageId,
        mode: "custom",
        questions: finalQuestions,
        mcqs: finalMCQs,
        project_task: finalTasks,
      });
      toast.success("Successfully assigned default test paper to job!");
      refetchAssignedPaper();
    } catch (err: any) {
      toast.error("Failed to assign test paper.");
    }
  };

  const handleUnassign = async () => {
    if (!job?.id || !selectedStageId) return;
    try {
      await unassignMutation.mutateAsync({ jobId: job.id, jobStageId: selectedStageId });
      toast.success("Successfully removed default test paper from this stage!");
      refetchAssignedPaper();
    } catch (err: any) {
      toast.error("Failed to remove assigned paper.");
    }
  };

  const formattedJobTitle = job?.title || "Job Profile";

  if (loadingJob) {
    return (
      <AppPageShell width="wide">
        <LoadingSpinner message="Loading job configurations..." fullPage={true} />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500">
      <AppPageHeader
        title={`Assign Question Paper - ${formattedJobTitle}`}
        headingClassName="text-xl sm:text-2xl"
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl font-semibold gap-1 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        }
      />

      <div className="space-y-2 pb-1">
        {/* Stage selection & Current assignment section */}
        <div className="rounded-xl border border-border bg-card p-2 shadow-xs space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <Label className="text-xs font-bold text-foreground">Select Technical Round Stage</Label>
              {questionStages.length > 0 ? (
                <SearchableSelect
                  value={selectedStageId}
                  onValueChange={setSelectedStageId}
                  options={questionStages.map((s) => ({ id: s.id, label: s.template.name }))}
                  placeholder="Choose an interview stage..."
                  searchPlaceholder="Search stage..."
                  emptyMessage="No stage found"
                />
              ) : (
                <div className="text-xs text-amber-500 font-semibold p-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  No technical stages requiring technical questions are configured for this job.
                </div>
              )}
            </div>

            {/* Current assignment panel */}
            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-border pt-2 md:pt-0 md:pl-2">
              <Label className="text-xs font-bold text-foreground">Active Assigned Test Paper</Label>
              {loadingAssignedPaper ? (
                <div className="text-xs text-muted-foreground py-1">Loading current assigned paper...</div>
              ) : assignedPaper ? (
                <div className="space-y-1.5 mt-1">
                  <div className="flex items-center justify-between bg-muted/20 p-1 rounded-lg border border-border/50 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{assignedPaper.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {assignedPaper.questions?.length || 0} Qs • {assignedPaper.mcqs?.length || 0} MCQs •{" "}
                          {assignedPaper.project_task?.length || 0} Tasks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] font-semibold gap-1"
                        onClick={() => setShowCurrentDetails(!showCurrentDetails)}
                      >
                        {showCurrentDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showCurrentDetails ? "Hide" : "Details"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
                        onClick={handleUnassign}
                        disabled={unassignMutation.isPending}
                      >
                        Remove Paper
                      </Button>
                    </div>
                  </div>

                  {showCurrentDetails && (
                    <div className="p-2 border border-border/30 rounded-xl bg-card/50 max-h-60 overflow-y-auto">
                      <PaperContentDisplay
                        questions={assignedPaper.questions}
                        mcqs={assignedPaper.mcqs}
                        project_task={assignedPaper.project_task}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No default paper currently assigned for this stage.</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Randomly Selected Pool (Checked by Default) */}
        <div className="app-surface-card p-2 space-y-2">
          <div className="flex items-center justify-between border-b pb-1.5 border-border/40">
            <div>
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Randomly Selected Pool
              </h3>
              <p className="text-[10px] text-muted-foreground">Checked by default. Uncheck to exclude.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] font-semibold"
              onClick={() => refetchRandomPreview()}
              disabled={loadingRandomPreview}
            >
              Regenerate Pool
            </Button>
          </div>

          {loadingRandomPreview ? (
            <div className="text-xs text-muted-foreground py-2 text-center">Loading randomized pool...</div>
          ) : randomPoolQuestions.length === 0 && randomPoolMCQs.length === 0 && randomPoolTasks.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">No pool available for this job profile.</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {/* Normal questions in Pool */}
              {randomPoolQuestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Normal Questions</p>
                  {randomPoolQuestions.map((item, idx) => {
                    const isChecked = selectedQuestions.some((q) => q.question === item.question);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer"
                        onClick={() => toggleQuestionSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">{item.question}</p>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Marks: {item.marks || 5} • Duration: {item.duration || 3} mins
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MCQs in Pool */}
              {randomPoolMCQs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Multiple Choice (MCQs)</p>
                  {randomPoolMCQs.map((item, idx) => {
                    const isChecked = selectedMCQs.some((m) => m.question === item.question);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer"
                        onClick={() => toggleMCQSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">{item.question}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">
                            Options: {item.options?.join(" | ") || ""}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Marks: {item.marks || 5} • Duration: {item.duration || 3} mins
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tasks in Pool */}
              {randomPoolTasks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Project Tasks</p>
                  {randomPoolTasks.map((item, idx) => {
                    const key = item.task || item.title || "";
                    const isChecked = selectedTasks.some((t) => (t.task || t.title) === key);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer"
                        onClick={() => toggleTaskSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">{item.task || item.title}</p>
                          {item.instructions && <p className="text-[10px] text-muted-foreground truncate">{item.instructions}</p>}
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Duration: {item.duration || item.total_duration || 30} mins
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Available Pool (Unchecked by Default) */}
        <div className="app-surface-card p-2 space-y-2">
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              Available Question Bank Pool
            </h3>
            <p className="text-[10px] text-muted-foreground">Remaining questions in library for this job. Unchecked by default.</p>
          </div>

          {loadingAllContent ? (
            <div className="text-xs text-muted-foreground py-2 text-center">Loading job question library...</div>
          ) : availablePoolQuestions.length === 0 && availablePoolMCQs.length === 0 && availablePoolTasks.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">No other questions available for this job profile.</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {/* Normal questions in Available Bank */}
              {availablePoolQuestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Normal Questions</p>
                  {availablePoolQuestions.map((item, idx) => {
                    const isChecked = selectedQuestions.some((q) => q.question === item.question);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer"
                        onClick={() => toggleQuestionSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">{item.question}</p>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Marks: {item.marks || 5} • Duration: {item.duration || 3} mins
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MCQs in Available Bank */}
              {availablePoolMCQs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Multiple Choice (MCQs)</p>
                  {availablePoolMCQs.map((item, idx) => {
                    const isChecked = selectedMCQs.some((m) => m.question === item.question);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer"
                        onClick={() => toggleMCQSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">{item.question}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">
                            Options: {item.options?.join(" | ") || ""}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Marks: {item.marks || 5} • Duration: {item.duration || 3} mins
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tasks in Available Bank */}
              {availablePoolTasks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Project Tasks</p>
                  {availablePoolTasks.map((item, idx) => {
                    const key = item.task || item.title || "";
                    const isChecked = selectedTasks.some((t) => (t.task || t.title) === key);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer"
                        onClick={() => toggleTaskSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">{item.task || item.title}</p>
                          {item.instructions && <p className="text-[10px] text-muted-foreground truncate">{item.instructions}</p>}
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Duration: {item.duration || item.total_duration || 30} mins
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Custom Added Questions List (If any exist) */}
        {(customQuestions.length > 0 || customMCQs.length > 0 || customTasks.length > 0) && (
          <div className="app-surface-card p-2 space-y-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              Custom Added Questions
            </h3>
            <div className="space-y-2 pr-1">
              {customQuestions.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 bg-emerald-500/5 gap-2"
                >
                  <div className="text-xs">
                    <p className="font-bold text-foreground">{item.question}</p>
                    <span className="text-[10px] text-muted-foreground">
                      Marks: {item.marks} • Duration: {item.duration} mins (Normal Question)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setCustomQuestions((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {customMCQs.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 bg-emerald-500/5 gap-2"
                >
                  <div className="text-xs">
                    <p className="font-bold text-foreground">{item.question}</p>
                    <span className="text-[10px] text-muted-foreground">
                      Correct: {item.answer} • Marks: {item.marks} • Duration: {item.duration} mins (MCQ)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setCustomMCQs((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {customTasks.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 bg-emerald-500/5 gap-2"
                >
                  <div className="text-xs">
                    <p className="font-bold text-foreground">{item.task || item.title}</p>
                    <span className="text-[10px] text-muted-foreground">
                      Duration: {item.duration} mins • Subtasks: {item.tasks?.length || 0} (Project Task)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setCustomTasks((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Dynamic Custom Questions Creator (Zod Validated) */}
        <div className="app-surface-card p-2 space-y-2">
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-primary" />
              Create Custom Question / Task
            </h3>
            <p className="text-[10px] text-muted-foreground">Fill in fields and click Add to append to the paper.</p>
          </div>

          {/* Type Selector Tabs */}
          <div className="flex border-b border-border/50 gap-1.5 mb-1.5">
            <button
              type="button"
              className={`pb-1 text-xs font-bold transition-all border-b-2 px-1 ${contentType === "question"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setContentType("question")}
            >
              Normal Question
            </button>
            <button
              type="button"
              className={`pb-1 text-xs font-bold transition-all border-b-2 px-1 ${contentType === "mcq"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setContentType("mcq")}
            >
              MCQ Question
            </button>
            <button
              type="button"
              className={`pb-1 text-xs font-bold transition-all border-b-2 px-1 ${contentType === "project_task"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setContentType("project_task")}
            >
              Project Task
            </button>
          </div>

          {/* Form Content */}
          <div className="bg-muted/10 p-1.5 rounded-lg border border-border/30">
            {contentType === "question" && (
              <SingleQuestionFormFields
                questionText={questionText}
                onQuestionChange={setQuestionText}
                marks={questionMarks}
                onMarksChange={setQuestionMarks}
                hours={questionHours}
                onHoursChange={setQuestionHours}
                minutes={questionMinutes}
                onMinutesChange={setQuestionMinutes}
                errors={errors}
                onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: "" }))}
              />
            )}

            {contentType === "mcq" && (
              <MCQFormFields
                mcqQuestion={mcqQuestion}
                onMCQQuestionChange={setMCQQuestion}
                mcqOptions={mcqOptions}
                onMCQOptionsChange={setMCQOptions}
                mcqAnswer={mcqAnswer}
                onMCQAnswerChange={setMCQAnswer}
                marks={mcqMarks}
                onMarksChange={setMCqMarks}
                hours={mcqHours}
                onHoursChange={setMCqHours}
                minutes={mcqMinutes}
                onMinutesChange={setMCqMinutes}
                errors={errors}
                onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: "" }))}
              />
            )}

            {contentType === "project_task" && (
              <ProjectTaskFormFields
                taskDescription={taskDescription}
                onDescriptionChange={setTaskDescription}
                taskInstructions={taskInstructions}
                onInstructionsChange={setTaskInstructions}
                hours={taskHours}
                onHoursChange={setTaskHours}
                minutes={taskMinutes}
                onMinutesChange={setTaskMinutes}
                tasks={projectTasks}
                onTasksChange={setProjectTasks}
                errors={errors}
                onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: "" }))}
              />
            )}

            <div className="flex justify-end pt-1">
              <Button type="button" size="sm" className="h-8 text-xs font-semibold gap-1" onClick={handleAddCustom}>
                <Plus className="h-3.5 w-3.5" />
                Add to Paper
              </Button>
            </div>
          </div>
        </div>

        {/* Section 5: Live Preview of Selected Configuration (Collapsible) */}
        <div className="app-surface-card p-2 space-y-2">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left outline-none"
            onClick={() => setShowLivePreview(!showLivePreview)}
          >
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-primary" />
              Live Preview of Selected Configuration ({selectedQuestions.length + customQuestions.length} Qs •{" "}
              {selectedMCQs.length + customMCQs.length} MCQs • {selectedTasks.length + customTasks.length} Tasks)
            </h3>
            {showLivePreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showLivePreview && (
            <div className="pt-2 border-t border-border/30 max-h-[350px] overflow-y-auto pr-1">
              <PaperContentDisplay
                questions={[...selectedQuestions, ...customQuestions]}
                mcqs={[...selectedMCQs, ...customMCQs]}
                project_task={[...selectedTasks, ...customTasks]}
              />
            </div>
          )}
        </div>

        {/* Page Actions */}
        <div className="flex items-center justify-center gap-2 border-t pt-2 border-border/40">
          <Button variant="outline" size="sm" className="h-9 font-semibold rounded-xl" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-9 font-bold "
            onClick={handleAssign}
            disabled={assignMutation.isPending}
          >
            <Save className="h-4 w-4" />
            Assign Paper
          </Button>
        </div>
      </div>
    </AppPageShell>
  );
}
