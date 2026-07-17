/**
 * @module AssignPaperPage
 * @component AssignPaperPage
 *
 * Evaluation setup page for selecting, assigning, and customizing test papers for candidates.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useResolvedJobAndCandidate } from "@/hooks/queries/candidates/useCandidateStagesQueries";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Save,
  BookOpen,
  UserCheck,
  User,
  CheckSquare,
  Square,
  Pencil,
} from "lucide-react";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useGuidelines } from "@/hooks/queries/admin/useGuideline";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useDebouncedValue } from "@/hooks/useDebounced";
import { slugify } from "@/utils/slug";
import { formatDuration } from "@/utils/taskFormatter";
import { useJob, useJobTitle } from "@/hooks/queries/jobs/useJob";
import { useJobAssignedTask } from "@/hooks/queries/jobs/useJobTask";
import { useAllQuestionsAndTasks } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { useAssignTestPaperMutation, useDeleteJobDefaultTestPaperMutation } from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { taskService } from "@/apis/task";
import type { MCQItem, TaskItem, QuestionItem } from "@/types/taskPaper";
import { mcqFormSchema } from "@/schemas/taskPaper";
import { questionFormSchema, projectTaskSchema } from "@/schemas/question";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { QuestionsBankSkillSelector } from "@/components/questions-bank/QuestionsBankSkillSelector";

import { QuestionContentFormFields } from "@/components/questions-bank/QuestionContentFormFields";
import { CustomPaperItemEditor } from "@/components/questions-bank/CustomPaperItemEditor";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { MCQQuestionDisplay } from "@/components/shared/MCQQuestionDisplay";
import { ProjectTaskDisplay } from "@/components/shared/ProjectTaskDisplay";
import { SingleQuestionDisplay } from "@/components/shared/SingleQuestionDisplay";
import { TotalSelectedQuestions } from "@/components/shared/question/TotalSelectedQuestions";
import { TotalMarks } from "@/components/shared/question/TotalMarks";
import { TotalDuration } from "@/components/shared/question/TotalDuration";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";
import { toTitleCase } from "@/lib/utils";

export type QuestionType = "question" | "mcq" | "project_task"

export default function AssignPaperPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobSlug, candidateName: candidateNameSlug, stageSlug } = useParams<{
    jobSlug: string;
    candidateName?: string;
    stageSlug?: string;
  }>();

  // Candidate-specific mode: resolve candidate from URL params or location.state
  const stateCandidateId = location.state?.candidateId as string | undefined;
  const stateCandidateName = location.state?.candidateName as string | undefined;
  const stateStageId = location.state?.stageId as string | undefined;

  const { candidate: resolvedCandidate } = useResolvedJobAndCandidate({
    jobSlug,
    candidateNameSlug,
    stateJob: location.state?.job,
    stateCandidateId,
  });

  const candidateId = resolvedCandidate?.id || stateCandidateId;
  const isCandidateMode = !!candidateId;
  const candidateDisplayName = resolvedCandidate
    ? `${resolvedCandidate.first_name || ""} ${resolvedCandidate.last_name || ""}`.trim()
    : (stateCandidateName || candidateNameSlug?.replace(/-/g, " ") || "Candidate");

  // Setup React Hook Form for custom skill selections
  const skillForm = useForm({
    defaultValues: {
      skill_ids: [] as string[],
    },
  });

  const selectedSkillIds = skillForm.watch("skill_ids") || [];

  // Fetch job title list to resolve ID from slug
  const { data: jobsList, loading: loadingJobsList } = useJobTitle("", !!jobSlug);

  const resolvedJobId = useMemo(() => {
    if (!jobsList || !jobSlug) return undefined;
    const found = jobsList.find((j) => slugify(j.title) === jobSlug);
    return found ? found.id : undefined;
  }, [jobsList, jobSlug]);

  // Fetch job detail
  const { data: job, loading: loadingJobDetail } = useJob(resolvedJobId);

  const loadingJob = loadingJobsList || loadingJobDetail;

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

  // Fetch guidelines
  const { data: guidelines, loading: loadingGuidelines } = useGuidelines({ skip: 0, limit: 100 });
  const [selectedGuidelineId, setSelectedGuidelineId] = useState<string>(() => guidelines?.find((val) => val.is_default)?.id || "");

  // Automatically select the default guideline once guidelines are loaded
  useEffect(() => {
    if (guidelines && guidelines.length > 0 && !selectedGuidelineId) {
      const defaultGuideline = guidelines.find((val) => val.is_default);
      if (defaultGuideline) {
        setSelectedGuidelineId(defaultGuideline.id);
      }
    }
  }, [guidelines, selectedGuidelineId]);

  // Default to the first technical stage once loaded
  useEffect(() => {
    if (questionStages.length > 0 && !selectedStageId) {
      setSelectedStageId(questionStages[0].id);
    }
  }, [questionStages, selectedStageId]);

  // Fetch currently assigned job-level default paper
  const { data: assignedPaper, loading: loadingAssignedPaper, refetch: refetchAssignedPaper } = useJobAssignedTask(
    job?.id,
    // selectedStageId || undefined
  );

  // Trigger state to determine if random preview generator is active
  const [useRandomPool, setUseRandomPool] = useState(false);

  // Reset useRandomPool and clear custom selections when selectedStageId changes
  useEffect(() => {
    setUseRandomPool(false);
    setCustomQuestions([]);
    setCustomMCQs([]);
    setCustomTasks([]);
  }, [selectedStageId]);

  // Fetch random preview questions from the backend
  const { data: randomPreview, isLoading: loadingRandomPreview } = useQuery({
    queryKey: ["random-preview", job?.id, selectedStageId],
    queryFn: () => taskService.previewRandomQuestions({ jobId: job!.id, count: 5 }),
    enabled: !!job?.id && useRandomPool,
    staleTime: 0,
  });

  // Search states for filtering the available question bank pool
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Job ID tracking state for filtering, supporting fallback when job-specific results are empty
  const [allContentJobId, setAllContentJobId] = useState<string | undefined>(undefined);

  // Reset jobId when job or selected stage configuration changes
  useEffect(() => {
    if (job?.id) {
      setAllContentJobId(job.id);
    }
  }, [selectedStageId, job?.id]);

  // Reset allContentJobId back to job.id when user changes search query, to try job-specific papers first
  useEffect(() => {
    if (job?.id) {
      setAllContentJobId(job.id);
    }
  }, [debouncedSearch, job?.id]);

  // Fetch all question bank content for matching position/department
  const { data: allContent, loading: loadingAllContent } = useAllQuestionsAndTasks({
    jobId: allContentJobId,
    departmentId: job?.department_id || undefined,
    positionId: job?.position_id || undefined,
    q: debouncedSearch || undefined,
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

  const finalQuestions = useMemo(() => [...selectedQuestions, ...customQuestions], [selectedQuestions, customQuestions]);
  const finalMCQs = useMemo(() => [...selectedMCQs, ...customMCQs], [selectedMCQs, customMCQs]);
  const finalTasks = useMemo(() => [...selectedTasks, ...customTasks], [selectedTasks, customTasks]);

  // Compute total duration of the currently configured paper (selected + custom)
  const finalTotalDuration = useMemo(() => {
    const qDur = finalQuestions.reduce((sum, q) => sum + (q.duration || 3), 0);
    const mDur = finalMCQs.reduce((sum, m) => sum + (m.duration || 3), 0);
    const tDur = finalTasks.reduce((sum, t) => sum + (t.duration || t.total_duration || 30), 0);
    return qDur + mDur + tDur;
  }, [finalQuestions, finalMCQs, finalTasks]);

  // Compute total marks of the currently configured paper (selected + custom)
  const finalTotalMarks = useMemo(() => {
    const qMarks = finalQuestions.reduce((sum, q) => sum + (q.marks || 5), 0);
    const mMarks = finalMCQs.reduce((sum, m) => sum + (m.marks || 5), 0);
    const tMarks = finalTasks.reduce((sum, t) => {
      if (typeof t === "string") return sum + 0;
      const calculatedMarks = t.total_marks || t.tasks?.reduce((subSum, st) => subSum + (st.marks || 0), 0) || 0;
      return sum + calculatedMarks;
    }, 0);
    return qMarks + mMarks + tMarks;
  }, [finalQuestions, finalMCQs, finalTasks]);

  const [contentType, setContentType] = useState<QuestionType>("question");

  // Form Hooks
  const questionForm = useForm<any>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      question: "",
      marks: "" as any,
      hours: "" as any,
      minutes: "" as any,
    },
  });

  const mcqForm = useForm<any>({
    resolver: zodResolver(mcqFormSchema),
    defaultValues: {
      question: "",
      options: ["", ""],
      answer: "",
      marks: "" as any,
      hours: "" as any,
      minutes: "" as any,
    },
  });

  const projectTaskForm = useForm<any>({
    resolver: zodResolver(projectTaskSchema),
    defaultValues: {
      project_task: "",
      instructions: "",
      hours: "" as any,
      minutes: "" as any,
      tasks: [],
    },
  });

  // Helper to check if any inputs in the question creation draft are not empty
  const hasActiveCreationDraft = () => {
    if (contentType === "question") {
      const values = questionForm.getValues();
      return (
        (values.question || "").trim() !== "" ||
        values.marks !== "" ||
        values.hours !== "" ||
        values.minutes !== ""
      );
    }
    if (contentType === "mcq") {
      const values = mcqForm.getValues();
      return (
        (values.question || "").trim() !== "" ||
        (values.options || []).some((opt: string) => opt.trim() !== "") ||
        values.answer !== "" ||
        values.marks !== "" ||
        values.hours !== "" ||
        values.minutes !== ""
      );
    }
    if (contentType === "project_task") {
      const values = projectTaskForm.getValues();
      return (
        (values.project_task || "").trim() !== "" ||
        (values.instructions || "").trim() !== "" ||
        values.hours !== "" ||
        values.minutes !== "" ||
        (values.tasks || []).length > 0
      );
    }
    return false;
  };

  // State for inline editing of custom items
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [editingMCQIdx, setEditingMCQIdx] = useState<number | null>(null);
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);

  // Helper functions to manage editing states
  const handleStartEditQuestion = (idx: number, _item: QuestionItem) => {
    if (hasActiveCreationDraft()) {
      toast.warning("Inputs are not empty!");
      return;
    }
    setEditingQuestionIdx(idx);
  };

  const handleStartEditMCQ = (idx: number, _item: MCQItem) => {
    if (hasActiveCreationDraft()) {
      toast.warning("Inputs are not empty!");
      return;
    }
    setEditingMCQIdx(idx);
  };

  const handleStartEditTask = (idx: number, _item: TaskItem) => {
    if (hasActiveCreationDraft()) {
      toast.warning("Inputs are not empty!");
      return;
    }
    setEditingTaskIdx(idx);
  };

  // Setup pools and default selections from assigned default test paper if one exists
  useEffect(() => {
    if (!assignedPaper) {
      if (!useRandomPool) {
        setRandomPoolQuestions([]);
        setRandomPoolMCQs([]);
        setRandomPoolTasks([]);
        setSelectedQuestions([]);
        setSelectedMCQs([]);
        setSelectedTasks([]);
      }
      return;
    }

    const normQs = (assignedPaper.questions || []).map((q) =>
      typeof q === "string" ? { question: q, marks: 5, duration: 3 } : q
    );
    const normMcqs = assignedPaper.mcqs || [];
    const normTasks = (assignedPaper.project_task || []).map((t) =>
      typeof t === "string" ? { task: t, description: t, instructions: "", duration: 30, tasks: [] } : t
    );

    setRandomPoolQuestions(normQs);
    setRandomPoolMCQs(normMcqs);
    setRandomPoolTasks(normTasks);

    // Checked by default
    setSelectedQuestions(normQs);
    setSelectedMCQs(normMcqs);
    setSelectedTasks(normTasks);

    if (assignedPaper.guideline_id) {
      setSelectedGuidelineId(assignedPaper.guideline_id);
    }
  }, [assignedPaper, useRandomPool]);

  // Setup pools and default selections from random pool when fallback is triggered
  useEffect(() => {
    if (!useRandomPool || !randomPreview) return;
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
  }, [randomPreview, useRandomPool]);

  // Setup remaining available questions for the available bank pool (filtered to exclude active pool duplicates)
  useEffect(() => {
    if (!allContent) return;
    const activePoolQs = randomPoolQuestions.map((q) => q.question);
    const activePoolMcqs = randomPoolMCQs.map((m) => m.question);
    const activePoolTasks = randomPoolTasks.map((t) => t.task || t.title || "");

    const normQs = (allContent.questions || [])
      .map((q) => (typeof q === "string" ? { question: q, marks: 5, duration: 3 } : q))
      .filter((q) => !activePoolQs.includes(q.question));

    const normMcqs = (allContent.mcqs || []).filter((m) => !activePoolMcqs.includes(m.question));

    const normTasks = (allContent.project_task || [])
      .map((t) =>
        typeof t === "string" ? { task: t, description: t, instructions: "", duration: 30, tasks: [] } : t
      )
      .filter((t) => !activePoolTasks.includes(t.task || t.title || ""));

    setAvailablePoolQuestions(normQs);
    setAvailablePoolMCQs(normMcqs);
    setAvailablePoolTasks(normTasks);
  }, [allContent, randomPoolQuestions, randomPoolMCQs, randomPoolTasks]);

  // Fallback to department/position level only (without jobId/skills) if job-specific content is empty or contains no new available questions
  useEffect(() => {
    if (
      !loadingAllContent &&
      allContent &&
      allContentJobId &&
      availablePoolQuestions.length === 0 &&
      availablePoolMCQs.length === 0 &&
      availablePoolTasks.length === 0
    ) {
      setAllContentJobId(undefined);
    }
  }, [
    allContent,
    allContentJobId,
    loadingAllContent,
    availablePoolQuestions,
    availablePoolMCQs,
    availablePoolTasks,
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setErrors({});
  }, [contentType]);

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
  const handleAddCustom = async () => {
    setErrors({});
    if (selectedSkillIds.length === 0) {
      setErrors((prev) => ({
        ...prev,
        skill_ids: "At least one skill is required.",
      }));
      // return;
    }
    if (contentType === "question") {
      const isValid = await questionForm.trigger();
      if (!isValid) return;

      const values = questionForm.getValues();
      const newItem: QuestionItem = {
        question: values.question.trim(),
        marks: Number(values.marks),
        duration: (Number(values.hours) || 0) * 60 + (Number(values.minutes) || 0),
        skill_ids: selectedSkillIds,
      };

      setCustomQuestions((prev) => [...prev, newItem]);
      questionForm.reset({ question: "", marks: "", hours: "", minutes: "" });
      skillForm.setValue("skill_ids", []);
      toast.success("Added custom normal question.");
    } else if (contentType === "mcq") {
      const isValid = await mcqForm.trigger();
      if (!isValid) return;

      const values = mcqForm.getValues();
      const answerIndex = values.answer.charCodeAt(0) - 65;
      const answerText = (values.options as any[])[answerIndex] || "";

      const newItem: MCQItem = {
        question: values.question.trim(),
        options: (values.options as any[]).map((o: any) => o.trim()),
        answer: answerText.trim(),
        marks: Number(values.marks),
        duration: (Number(values.hours) || 0) * 60 + (Number(values.minutes) || 0),
        skill_ids: selectedSkillIds,
      };

      setCustomMCQs((prev) => [...prev, newItem]);
      mcqForm.reset({ question: "", options: ["", ""], answer: "", marks: "", hours: "", minutes: "" });
      skillForm.setValue("skill_ids", []);
      toast.success("Added custom MCQ question.");
    } else if (contentType === "project_task") {
      const isValid = await projectTaskForm.trigger();
      if (!isValid) return;

      const values = projectTaskForm.getValues();
      const duration = (Number(values.hours) || 0) * 60 + (Number(values.minutes) || 0);

      const newItem: TaskItem = {
        task: values.project_task.trim(),
        instructions: values.instructions.trim(),
        title: values.project_task.trim(),
        description: values.project_task.trim(),
        duration,
        tasks: values.tasks.map((t: any) => ({
          name: t.name,
          description: t.description || undefined,
          marks: t.marks,
        })),
        total_marks: values.tasks.reduce((sum: number, t: any) => sum + (t.marks || 0), 0),
        total_duration: duration,
        skill_ids: selectedSkillIds,
      };

      setCustomTasks((prev) => [...prev, newItem]);
      projectTaskForm.reset({ project_task: "", instructions: "", hours: "", minutes: "", tasks: [] });
      skillForm.setValue("skill_ids", []);
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

    if (finalQuestions.length === 0 && finalMCQs.length === 0 && finalTasks.length === 0) {
      toast.error("Please select or add at least one question or task.");
      return;
    }

    if (!selectedGuidelineId) {
      toast.error("Please select a terms & conditions template.");
      return;
    }

    try {
      if (isCandidateMode && candidateId) {
        // Candidate-specific assignment
        await assignMutation.mutateAsync({
          candidate_id: candidateId,
          // job_stage_id: stateStageId || selectedStageId, // not working when job_stage_id passed
          mode: "custom",
          questions: finalQuestions,
          mcqs: finalMCQs,
          project_task: finalTasks,
          custom_skills: job.skills?.map((s) => s.name) || [],
          guideline_id: selectedGuidelineId,
        });
        toast.success(`Successfully assigned test paper to ${candidateDisplayName}!`);
        refetchAssignedPaper();
        // Navigate to SendPaperPage for immediate email sending
        if (jobSlug && candidateNameSlug && stageSlug) {
          navigate(
            `/dashboard/jobs/${jobSlug}/candidates/${candidateNameSlug}/stages/${stageSlug}/send-paper`,
            // `/dashboard/jobs/${jobSlug}/candidates/${candidateNameSlug}/stages/${stageSlug}`, // just back
            {
              state: {
                job,
                candidateId,
                candidateName: candidateDisplayName,
                stageId: stateStageId || selectedStageId,
              },
            }
          );
        } else {
          navigate(-1);
        }
      } else {
        // Job-level default assignment
        await assignMutation.mutateAsync({
          job_id: job.id,
          job_stage_id: selectedStageId,
          mode: "custom",
          questions: finalQuestions,
          mcqs: finalMCQs,
          project_task: finalTasks,
          custom_skills: job.skills?.map((s) => s.name) || [],
          guideline_id: selectedGuidelineId,
        });
        toast.success("Successfully assigned default question paper to job!");
        refetchAssignedPaper();
        if (jobSlug) {
          navigate(`/dashboard/jobs/${jobSlug}/candidates`);
        } else {
          navigate(-1);
        }
      }
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to assign test paper."));
    }
  };

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleUnassign = async () => {
    if (!job?.id || !selectedStageId) return;
    try {
      await unassignMutation.mutateAsync({ jobId: job.id, jobStageId: selectedStageId });
      toast.success("Successfully removed default question paper from this stage!");
      refetchAssignedPaper();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to remove assigned paper."));
    }
  };

  const formattedJobTitle = toTitleCase(job?.title || "Job Profile");

  if (loadingJob) {
    return (
      <AppPageShell width="wide">
        <LoadingSpinner message="Loading job configurations..." fullPage={true} />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <AppPageHeader
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Assign Question Paper - {formattedJobTitle}</span>
            {isCandidateMode && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                <User className="h-3 w-3" />
                <span className="capitalize">{candidateDisplayName}</span>
              </span>
            )}
          </span>
        }
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
        {/* Paper Summary Panel */}
        <div className="bg-linear-to-r from-card to-muted/20 border border-border/80 p-3 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5 text-primary shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">Active Test Paper</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Dynamic configuration based on your selections and custom additions
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TotalSelectedQuestions totalQuestions={finalQuestions.length + finalMCQs.length + finalTasks.length} />
            <TotalMarks totalMarks={finalTotalMarks} />
            <TotalDuration totalDuration={formatDuration(finalTotalDuration)} />
          </div>
        </div>

        {/* Guideline Template Selection Section */}
        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-xs space-y-2 animate-in fade-in duration-300">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-foreground flex items-center gap-1">
              Select Terms & Conditions Template <Required />
            </label>

            <SearchableSelect
              value={selectedGuidelineId}
              onValueChange={setSelectedGuidelineId}
              options={guidelines.map((g) => ({
                id: g.id,
                label: g.content.length > 120 ? `${g.content.substring(0, 120)}...` : g.content
              }))}
              placeholder="Choose a terms & conditions template..."
              searchPlaceholder="Search terms & conditions..."
              emptyMessage="No terms & conditions found"
              loading={loadingGuidelines}
            />
          </div>
        </div>
        {/*
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
        </div> */}

        {/* Section 1: Randomly Selected Pool (Checked by Default) */}
        <div className="app-surface-card p-2 space-y-2 rounded-xl">
          <div className="flex items-center justify-between border-b pb-1.5 border-border/40">
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Randomly Selected Questions
              </h3>
              {/* {(randomPoolQuestions.length > 0 || randomPoolMCQs.length > 0 || randomPoolTasks.length > 0) && (
                <div className="flex gap-2">
                  <TotalMarks totalMarks={finalTotalMarks} />
                  <TotalDuration totalDuration={formatDuration(finalTotalDuration)} />
                </div>
              )} */}
            </div>
            {/* */}
            {/*
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] font-semibold"
              onClick={() => {
                setUseRandomPool(true);
                refetchRandomPreview();
              }}
              disabled={loadingRandomPreview}
            >
              Regenerate Pool
            </Button>
            */}
          </div>

          {loadingAssignedPaper ? (
            <div className="text-xs text-muted-foreground py-2 text-center">Loading assigned paper...</div>
          ) : loadingRandomPreview ? (
            <div className="text-xs text-muted-foreground py-2 text-center">Loading randomized questions...</div>
          ) : !assignedPaper && !useRandomPool ? (
            <div className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg border-border/60">
              No default paper has been assigned to this stage yet.
              {/* Generate Random Pool button - implemented but hidden */}
              {/*
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs font-semibold"
                onClick={() => {
                  setUseRandomPool(true);
                  refetchRandomPreview();
                }}
              >
                Generate Random Pool
              </Button>
              */}
            </div>
          ) : randomPoolQuestions.length === 0 && randomPoolMCQs.length === 0 && randomPoolTasks.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">No questions available for this job profile.</div>
          ) : (
            <div className="space-y-2 overflow-y-auto">
              {/* Normal questions in Pool */}
              {randomPoolQuestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold">Normal Questions</p>
                  {randomPoolQuestions.map((item, idx) => {
                    const isChecked = selectedQuestions.some((q) => q.question === item.question);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer text-xs"
                        onClick={() => toggleQuestionSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <SingleQuestionDisplay question={item} variant="simple" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MCQs in Pool */}
              {randomPoolMCQs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold">Multiple Choice (MCQs)</p>
                  {randomPoolMCQs.map((item, idx) => {
                    const isChecked = selectedMCQs.some((m) => m.question === item.question);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer text-xs"
                        onClick={() => toggleMCQSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <MCQQuestionDisplay mcq={item} variant="simple" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tasks in Pool */}
              {randomPoolTasks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold">Project Tasks</p>
                  {randomPoolTasks.map((item, idx) => {
                    const key = item.task || item.title || "";
                    const isChecked = selectedTasks.some((t) => (t.task || t.title) === key);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer text-xs"
                        onClick={() => toggleTaskSelection(item)}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <ProjectTaskDisplay task={item} variant="simple" showTypeSuffix={false} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Available Pool (Unchecked by Default) */}
        <div className="app-surface-card p-2 space-y-2 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-1.5 border-border/40">
            <div>
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                Available Questions
              </h3>
            </div>
            <div className="w-full sm:w-60">
              <Input
                type="text"
                placeholder="Search question bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs bg-muted/10 border border-border/40 focus-visible:ring-1"
              />
            </div>
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
                  <p className="text-xs font-bold">Normal Questions</p>
                  {availablePoolQuestions.map((item, idx) => {
                    const isChecked = selectedQuestions.some((q) => q.question === item.question);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-muted/10 cursor-pointer"
                        onClick={() => toggleQuestionSelection(item)}
                      >
                        <div className="mt-0.5 text-xs">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <SingleQuestionDisplay question={item} variant="simple" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MCQs in Available Bank */}
              {availablePoolMCQs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold">Multiple Choice (MCQs)</p>
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
                        <MCQQuestionDisplay mcq={item} variant="simple" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tasks in Available Bank */}
              {availablePoolTasks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold">Project Tasks</p>
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
                        <ProjectTaskDisplay task={item} variant="simple" showTypeSuffix={false} />
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
          <div className="app-surface-card p-2 space-y-2 rounded-xl">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              Custom Added Questions
            </h3>
            <div className="space-y-2 pr-1">
              {customQuestions.map((item, idx) => {
                if (editingQuestionIdx === idx) {
                  return (
                    <CustomPaperItemEditor
                      key={idx}
                      item={item}
                      type="question"
                      onSave={(updated) => {
                        setCustomQuestions((prev) => {
                          const next = [...prev];
                          next[idx] = updated;
                          return next;
                        });
                        setEditingQuestionIdx(null);
                      }}
                      onCancel={() => setEditingQuestionIdx(null)}
                    />
                  );
                }
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 gap-2"
                  >
                    <SingleQuestionDisplay
                      question={item}
                      variant="simple"
                      titleClassName="font-bold"
                      showTypeSuffix={true}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        onClick={() => handleStartEditQuestion(idx, item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setCustomQuestions((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {customMCQs.map((item, idx) => {
                if (editingMCQIdx === idx) {
                  return (
                    <CustomPaperItemEditor
                      key={idx}
                      item={item}
                      type="mcq"
                      onSave={(updated) => {
                        setCustomMCQs((prev) => {
                          const next = [...prev];
                          next[idx] = updated;
                          return next;
                        });
                        setEditingMCQIdx(null);
                      }}
                      onCancel={() => setEditingMCQIdx(null)}
                    />
                  );
                }
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 gap-2"
                  >
                    <MCQQuestionDisplay
                      mcq={item}
                      variant="simple"
                      titleClassName="font-bold"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        onClick={() => handleStartEditMCQ(idx, item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setCustomMCQs((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {customTasks.map((item, idx) => {
                if (editingTaskIdx === idx) {
                  return (
                    <CustomPaperItemEditor
                      key={idx}
                      item={item}
                      type="project_task"
                      onSave={(updated) => {
                        setCustomTasks((prev) => {
                          const next = [...prev];
                          next[idx] = updated;
                          return next;
                        });
                        setEditingTaskIdx(null);
                      }}
                      onCancel={() => setEditingTaskIdx(null)}
                    />
                  );
                }
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 gap-2"
                  >
                    <ProjectTaskDisplay
                      task={item}
                      variant="simple"
                      titleClassName="font-bold"
                      showTypeSuffix={false}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        onClick={() => handleStartEditTask(idx, item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setCustomTasks((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4: Dynamic Custom Questions Creator (Zod Validated) */}
        <div className="app-surface-card p-2 space-y-2 rounded-xl">
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-primary" />
              Create Custom Question / Task
            </h3>
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
              <Form {...questionForm}>
                <QuestionContentFormFields contentType={contentType} />
              </Form>
            )}
            {contentType === "mcq" && (
              <Form {...mcqForm}>
                <QuestionContentFormFields contentType={contentType} />
              </Form>
            )}
            {contentType === "project_task" && (
              <Form {...projectTaskForm}>
                <QuestionContentFormFields contentType={contentType} />
              </Form>
            )}

            {/* Skills Selector Section */}
            <div className="mt-4 p-2 bg-background rounded-lg border border-border/50">
              <Form {...skillForm}>
                <QuestionsBankSkillSelector
                  initialSelectedSkills={[]}
                />
              </Form>
              {errors.skill_ids && (
                <p className="text-destructive text-xs font-semibold mt-1.5">{errors.skill_ids}</p>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <Button type="button" size="sm" className="h-8 text-xs font-semibold gap-1" onClick={handleAddCustom}>
                <Plus className="h-3.5 w-3.5" />
                Add to Paper
              </Button>
            </div>
          </div>
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
            disabled={assignMutation.isPending || hasActiveCreationDraft()}
          >
            <Save className="h-4 w-4" />
            Assign Paper
          </Button>
        </div>
        <p className="text-xs font-medium text-yellow-500 text-center mt-2">{hasActiveCreationDraft() ? "Please add or clear the draft question first before assigning" : " "}</p>
      </div>
    </AppPageShell>
  );
}
