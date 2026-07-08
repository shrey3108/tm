/**
 * @module QuestionsBankCreate
 * @component QuestionsBankCreate
 *
 * Creation form for adding new questions with options and test cases to the Questions Bank.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { usePageFilters } from "@/hooks/usePageFilters";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { QuestionsBankSkillSelector } from "@/components/questions-bank/QuestionsBankSkillSelector";
import { Form } from "@/components/ui/form";
import { Required } from "@/components/shared/Required";
import { PERMISSIONS, hasPermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import {
  useQuestionSetPaper,
  useQuestionSetPapers,
} from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useCreateQuestionSetPaperMutation,
  useAddQuestionToPaperMutation,
  useUpdateQuestionInPaperMutation,
  useAddProjectTaskToPaperMutation,
  useUpdateProjectTaskInPaperMutation,
  useAddMCQToPaperMutation,
  useUpdateMCQInPaperMutation,
  useUploadQuestionSetPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import type { MCQItem, TaskItem, SubTaskItem, QuestionItem } from "@/types/taskPaper";
import { mcqFormSchema } from "@/schemas/taskPaper";
import { questionFormSchema, projectTaskSchema } from "@/schemas/question";
import { extractErrorMessage } from "@/utils/error";
import { slugify } from "@/utils/slug";

// Form field components
import { SingleQuestionFormFields } from "@/components/questions-bank/SingleQuestionFormFields";
import { MCQFormFields } from "@/components/questions-bank/MCQFormFields";
import { ProjectTaskFormFields } from "@/components/questions-bank/ProjectTaskFormFields";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useDebouncedValue } from "@/hooks/useDebounced";



export default function QuestionsBankCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();

  const user = useAppSelector(selectCurrentUser);
  const isAllowedToManage = hasPermissions(user?.permissions, PERMISSIONS.QUESTIONS_MANAGE, "any");

  const isEditMode = !!slug && slug !== "new";

  // Get initial values from routing state (item-specific, not filter state)
  const {
    paperId: initialPaperId,
    itemIndex: initialItemIndex,
    itemType: initialItemType,
  } = (location.state as any) || {};

  // Read department/position from Redux (shared with QuestionsBank listing page)
  const { filters: questionsBankFilters } = usePageFilters("questionsBank", {
    selectedDeptId: "",
    selectedPositionId: "",
    selectedSkillId: "",
    selectedContentType: "all",
  });

  const [departmentId, setDepartmentId] = useState<string>(questionsBankFilters.selectedDeptId || "");
  const [positionId, setPositionId] = useState<string>(questionsBankFilters.selectedPositionId || "");
  const [deptSearch, setDeptSearch] = useState<string>("");

  const debouncedDeptSearch = useDebouncedValue(deptSearch);
  const isDeptSearching = deptSearch !== debouncedDeptSearch;
  const handleDeptSearch = useCallback((query: string) => setDeptSearch(query), []);

  // Fetch departments and positions
  const { data: departments, loading: loadingDepts } = useDepartment({ skip: 0, limit: 100, q: debouncedDeptSearch });
  const { data: positions, loading: loadingPositions } = useJobPosition({ skip: 0, limit: 10 });

  // Queries for Edit Mode
  const { data: fetchedPaper, loading: loadingFetchedPaper, refetch: refetchFetchedPaper } = useQuestionSetPaper(initialPaperId);
  const { data: allPapers = [], loading: loadingAllPapers, refetch: refetchAllPapers } = useQuestionSetPapers({
    options: { enabled: isEditMode && !initialPaperId }
  });

  const paperToEdit = useMemo(() => {
    if (!isEditMode) return null;
    if (initialPaperId) return fetchedPaper;
    return allPapers.find((p) => slugify(p.name) === slug) || null;
  }, [isEditMode, initialPaperId, fetchedPaper, allPapers, slug]);

  const loadingPaper = isEditMode && (initialPaperId ? loadingFetchedPaper : loadingAllPapers);

  const refetchPaper = useCallback(() => {
    if (initialPaperId) {
      refetchFetchedPaper();
    } else {
      refetchAllPapers();
    }
  }, [initialPaperId, refetchFetchedPaper, refetchAllPapers]);

  // Mutations
  const createPaperMutation = useCreateQuestionSetPaperMutation();
  const addQuestionMutation = useAddQuestionToPaperMutation();
  const updateQuestionMutation = useUpdateQuestionInPaperMutation();

  const addProjectTaskMutation = useAddProjectTaskToPaperMutation();
  const updateProjectTaskMutation = useUpdateProjectTaskInPaperMutation();

  const addMCQMutation = useAddMCQToPaperMutation();
  const updateMCQMutation = useUpdateMCQInPaperMutation();

  const uploadMutation = useUploadQuestionSetPaperMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Setup React Hook Form to use SkillSelectorSection
  const form = useForm({
    defaultValues: {
      skill_ids: [] as string[],
    },
  });

  const selectedSkillIds = form.watch("skill_ids") || [];

  // Single-Question Form state
  const [contentType, setContentType] = useState<"question" | "mcq" | "project_task">(
    initialItemType || "question"
  );
  const itemIndex = useMemo(() => {
    return initialItemIndex !== undefined ? Number(initialItemIndex) : 0;
  }, [initialItemIndex]);
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

  // Clear validation errors when changing content type or options length
  useEffect(() => {
    setErrors({});
  }, [contentType, mcqOptions.length]);

  // Sync backend paper state to local Form in Edit Mode
  useEffect(() => {
    if (isEditMode && paperToEdit) {
      setDepartmentId(paperToEdit.department_id || "");
      setPositionId(paperToEdit.position_id || "");

      let itemSkillIds = paperToEdit.skills?.map((s) => s.id) || paperToEdit.task_skills || [];

      // Determine content type and pre-populate
      if (initialItemType) {
        setContentType(initialItemType);
        if (initialItemType === "mcq" && paperToEdit.mcqs && paperToEdit.mcqs[itemIndex]) {
          const mcq = paperToEdit.mcqs[itemIndex];
          setMCQQuestion(mcq.question || "");

          const rawOptions = mcq.options || [];
          setMCQOptions(rawOptions);

          const answerText = mcq.answer || "";
          const answerIndex = rawOptions.indexOf(answerText);
          const answerLetter = answerIndex !== -1 ? String.fromCharCode(65 + answerIndex) : "A";
          setMCQAnswer(answerLetter);
          setMCqMarks(mcq.marks || "");
          const mDur = mcq.duration || 0;
          setMCqHours(Math.floor(mDur / 60) || "");
          setMCqMinutes(mDur % 60 || "");
          if (mcq.skill_ids && mcq.skill_ids.length > 0) {
            itemSkillIds = mcq.skill_ids;
          }
        } else if (initialItemType === "project_task" && paperToEdit.project_task && paperToEdit.project_task[itemIndex]) {
          const task = paperToEdit.project_task[itemIndex];
          if (typeof task === "string") {
            setTaskDescription(task);
            setTaskInstructions("");
            setTaskHours("");
            setTaskMinutes("");
            setProjectTasks([]);
          } else {
            setTaskDescription((task)?.task || "");
            setTaskInstructions((task)?.instructions || "");
            const dur = (task)?.duration || (task)?.total_duration || 0;
            setTaskHours(Math.floor(dur / 60) || "");
            setTaskMinutes(dur % 60 || "");
            setProjectTasks((task)?.tasks || []);
            if ((task)?.skill_ids && (task)?.skill_ids.length > 0) {
              itemSkillIds = (task)?.skill_ids;
            }
          }
        } else if (initialItemType === "question" && paperToEdit.questions && paperToEdit.questions[itemIndex]) {
          const q = paperToEdit.questions[itemIndex];
          if (typeof q === "string") {
            setQuestionText(q);
            setQuestionMarks("");
            setQuestionHours("");
            setQuestionMinutes("");
          } else {
            setQuestionText((q)?.question || "");
            setQuestionMarks((q)?.marks || "");
            const qDur = (q)?.duration || 0;
            setQuestionHours(Math.floor(qDur / 60) || "");
            setQuestionMinutes(qDur % 60 || "");
            if ((q)?.skill_ids && (q)?.skill_ids.length > 0) {
              itemSkillIds = (q).skill_ids;
            }
          }
        }
      } else {
        if (paperToEdit.mcqs && paperToEdit.mcqs.length > 0) {
          setContentType("mcq");
          const mcq = paperToEdit.mcqs[0];
          setMCQQuestion(mcq.question || "");

          const rawOptions = mcq.options || [];
          setMCQOptions(rawOptions);

          const answerText = mcq.answer || "";
          const answerIndex = rawOptions.indexOf(answerText);
          const answerLetter = answerIndex !== -1 ? String.fromCharCode(65 + answerIndex) : "A";
          setMCQAnswer(answerLetter);
          setMCqMarks(mcq.marks || "");
          const mDur = mcq.duration || 0;
          setMCqHours(Math.floor(mDur / 60) || "");
          setMCqMinutes(mDur % 60 || "");
          if (mcq.skill_ids && mcq.skill_ids.length > 0) {
            itemSkillIds = mcq.skill_ids;
          }
        } else if (paperToEdit.project_task && paperToEdit.project_task.length > 0) {
          setContentType("project_task");
          const task = paperToEdit.project_task[0];
          if (typeof task === "string") {
            setTaskDescription(task);
            setTaskInstructions("");
            setTaskHours("");
            setTaskMinutes("");
            setProjectTasks([]);
          } else {
            setTaskDescription((task)?.task || "");
            setTaskInstructions((task)?.instructions || "");
            const dur = (task)?.duration || (task)?.total_duration || 0;
            setTaskHours(Math.floor(dur / 60) || "");
            setTaskMinutes(dur % 60 || "");
            setProjectTasks((task)?.tasks || []);
            if ((task)?.skill_ids && (task).skill_ids.length > 0) {
              itemSkillIds = (task).skill_ids;
            }
          }
        } else {
          setContentType("question");
          const q = paperToEdit.questions?.[0];
          if (q) {
            if (typeof q === "string") {
              setQuestionText(q);
              setQuestionMarks("");
              setQuestionHours("");
              setQuestionMinutes("");
            } else {
              setQuestionText((q as any).question || "");
              setQuestionMarks((q as any).marks || "");
              const qDur = (q as any).duration || 0;
              setQuestionHours(Math.floor(qDur / 60) || "");
              setQuestionMinutes(qDur % 60 || "");
              if ((q as any).skill_ids && (q as any).skill_ids.length > 0) {
                itemSkillIds = (q as any).skill_ids;
              }
            }
          } else {
            setQuestionText("");
            setQuestionMarks("");
            setQuestionHours("");
            setQuestionMinutes("");
          }
        }
      }

      form.reset({ skill_ids: itemSkillIds });
    }
  }, [isEditMode, paperToEdit, form, initialItemType, itemIndex]);



  // File Upload handlers
  // @ts-ignore
  const handleUploadClick = () => {
    if (!departmentId) {
      toast.error("Please select a department first.");
      return;
    }
    if (!positionId) {
      toast.error("Please select experience / position level first.");
      return;
    }
    fileInputRef.current?.click();
  };
  // @ts-ignore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isEditMode && selectedSkillIds.length === 0) {
      toast.error("Please select at least one skill for the new question bank.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({
        departmentId,
        positionId,
        skillIds: isEditMode ? [] : selectedSkillIds,
        paperType: "mixed",
        file: file,
      });
      toast.success(`Successfully uploaded and triggered AI extraction for '${file.name}'!`);
      if (!isEditMode) {
        navigate("/dashboard/questions-bank");
      } else {
        refetchPaper();
      }
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, `Failed to upload file.`));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Submit/Save Action
  const handleSavePaper = async () => {
    if (!departmentId) {
      toast.error("Department is required.");
      return;
    }
    if (!positionId) {
      toast.error("Experience / Position Level is required.");
      return;
    }
    if (selectedSkillIds.length === 0) {
      toast.error("Please select at least one skill.");
      return;
    }

    // Validate content based on selected type
    let questionTextPayload: QuestionItem | string = "";
    if (contentType === "question") {
      const qHours = questionHours === "" ? 0 : Number(questionHours);
      const qMins = questionMinutes === "" ? 0 : Number(questionMinutes);
      const duration = qHours * 60 + qMins;

      const result = questionFormSchema.safeParse({
        question: questionText,
        marks: questionMarks === "" ? undefined : Number(questionMarks),
        hours: qHours,
        minutes: qMins,
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join(".");
          if (!newErrors[path]) {
            newErrors[path] = issue.message;
          }
        }
        setErrors(newErrors);
        return;
      }
      questionTextPayload = {
        question: questionText.trim(),
        marks: Number(questionMarks),
        duration,
        skill_ids: selectedSkillIds,
      };
    }

    let mcqItemPayload: MCQItem | null = null;
    if (contentType === "mcq") {
      const mHours = mcqHours === "" ? 0 : Number(mcqHours);
      const mMins = mcqMinutes === "" ? 0 : Number(mcqMinutes);
      const duration = mHours * 60 + mMins;

      const result = mcqFormSchema.safeParse({
        question: mcqQuestion,
        options: mcqOptions,
        answer: mcqAnswer,
        marks: mcqMarks === "" ? undefined : Number(mcqMarks),
        hours: mHours,
        minutes: mMins,
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.issues.forEach((issue: any) => {
          if (issue.path[0] === "options" && typeof issue.path[1] === "number") {
            const idx = issue.path[1];
            newErrors[`options.${idx}`] = issue.message;
          } else {
            const path = issue.path.join(".");
            newErrors[path] = issue.message;
          }
        });
        setErrors(newErrors);
        return;
      }

      const answerIndex = mcqAnswer.charCodeAt(0) - 65;
      const answerText = mcqOptions[answerIndex] || "";

      mcqItemPayload = {
        question: mcqQuestion.trim(),
        options: mcqOptions.map((opt) => opt.trim()),
        answer: answerText.trim(),
        marks: Number(mcqMarks),
        duration,
        skill_ids: selectedSkillIds,
      };
    }

    let projectTaskItemPayload: TaskItem | null = null;
    if (contentType === "project_task") {
      const result = projectTaskSchema.safeParse({
        project_task: taskDescription,
        instructions: taskInstructions,
        hours: taskHours,
        minutes: taskMinutes,
        tasks: projectTasks,
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join(".");
          if (!newErrors[path]) {
            newErrors[path] = issue.message;
          }
        }
        setErrors(newErrors);
        return;
      }

      const duration = (Number(taskHours) || 0) * 60 + (Number(taskMinutes) || 0);

      projectTaskItemPayload = {
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
        skill_ids: selectedSkillIds,
      };
    }

    if (isEditMode && paperToEdit) {
      // Edit Mode
      try {
        if (contentType === "question") {
          if (paperToEdit.questions && paperToEdit.questions.length > itemIndex) {
            await updateQuestionMutation.mutateAsync({
              paperId: paperToEdit.id,
              index: itemIndex,
              question: questionTextPayload,
              skillIds: selectedSkillIds,
            });
          } else {
            await addQuestionMutation.mutateAsync({
              paperId: paperToEdit.id,
              question: questionTextPayload,
              skillIds: selectedSkillIds,
            });
          }
        } else if (contentType === "mcq") {
          if (paperToEdit.mcqs && paperToEdit.mcqs.length > itemIndex) {
            await updateMCQMutation.mutateAsync({
              paperId: paperToEdit.id,
              index: itemIndex,
              mcq: mcqItemPayload!,
              skillIds: selectedSkillIds,
            });
          } else {
            await addMCQMutation.mutateAsync({
              paperId: paperToEdit.id,
              mcq: mcqItemPayload!,
              skillIds: selectedSkillIds,
            });
          }
        } else if (contentType === "project_task") {
          if (paperToEdit.project_task && paperToEdit.project_task.length > itemIndex) {
            await updateProjectTaskMutation.mutateAsync({
              paperId: paperToEdit.id,
              index: itemIndex,
              projectTask: projectTaskItemPayload!,
              skillIds: selectedSkillIds,
            });
          } else {
            await addProjectTaskMutation.mutateAsync({
              paperId: paperToEdit.id,
              projectTask: projectTaskItemPayload!,
              skillIds: selectedSkillIds,
            });
          }
        }
        toast.success("Successfully updated question set paper!");
        navigate("/dashboard/questions-bank");
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err, "Failed to update question set paper."));
      }
    } else {
      // Create Mode
      let paperType: "normal" | "mcq" | "task" = "normal";
      if (contentType === "mcq") {
        paperType = "mcq";
      } else if (contentType === "project_task") {
        paperType = "task";
      }

      try {
        const payload = {
          department_id: departmentId,
          position_id: positionId,
          skill_ids: selectedSkillIds,
          paper_type: paperType,
          questions: contentType === "question" ? [questionTextPayload] : [],
          mcqs: contentType === "mcq" ? [mcqItemPayload!] : [],
          project_task: contentType === "project_task" ? [projectTaskItemPayload!] : [],
        };

        await createPaperMutation.mutateAsync(payload);
        toast.success("Successfully created question paper template!");
        navigate("/dashboard/questions-bank");
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err, "Failed to create question set paper."));
      }
    }
  };

  const typeOptions = [
    { id: "question", label: "Normal Question" },
    { id: "mcq", label: "Multiple Choice (MCQ)" },
    { id: "project_task", label: "Project Task" },
  ] as const;

  if (loadingPaper) {
    return (
      <AppPageShell width="wide">
        <LoadingSpinner message="Loading question set paper..." fullPage={true} />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      width="wide"
    >
      <PageHeader
        title={isEditMode ? `Edit Question Paper: ${paperToEdit?.name || ""}` : "Define Question"}
        actions={
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => navigate("/dashboard/questions-bank")}
            className="rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        }
      />

      <div className="mx-auto w-full space-y-2">
        {/* Unified Selector/Filter row (matching listing page style) */}
        <div className="rounded-xl border border-border bg-card p-2 shadow-xs">
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-2 w-full",
            isAllowedToManage ? "lg:grid-cols-4" : "lg:grid-cols-3"
          )}>
            {/* Department Selector */}
            <div className="flex flex-col gap-0.5 w-full">
              <Label className="text-xs font-semibold">Select Department <Required /></Label>
              <SearchableSelect
                value={departmentId}
                onValueChange={setDepartmentId}
                options={departments?.map((dept) => ({ id: dept.id, label: dept.name })) || []}
                placeholder="Choose a department..."
                searchPlaceholder="Search departments..."
                disabled={isEditMode || !departments || departments.length === 0}
                loading={loadingDepts}
                loadingPlaceholder="Loading departments..."
                emptyMessage="No departments found"
                moreText="departments"
                onSearch={handleDeptSearch}
                asyncLoading={isDeptSearching}
              />
            </div>

            {/* Experience / Position Level Selector */}
            <div className="flex flex-col gap-0.5 w-full">
              <Label className="text-xs font-semibold">Experience / Position Level <Required /></Label>
              <SearchableSelect
                value={positionId}
                onValueChange={setPositionId}
                options={positions?.map((pos) => ({ id: pos.id, label: pos.name })) || []}
                placeholder="Choose position level..."
                searchPlaceholder="Search position levels..."
                disabled={isEditMode || loadingPositions}
                loading={loadingPositions}
                loadingPlaceholder="Loading positions..."
                emptyMessage="No position levels found"
                moreText="position levels"
              />
            </div>

            {/* Question Type Selector */}
            <div className="flex flex-col gap-0.5 w-full">
              <Label className="text-xs font-semibold">Question Type</Label>
              <SearchableSelect
                value={contentType}
                onValueChange={(val: any) => setContentType(val)}
                options={typeOptions.map((opt) => ({ id: opt.id, label: opt.label }))}
                placeholder="Select type..."
                searchPlaceholder="Search question types..."
                disabled={isEditMode}
                emptyMessage="No question types found"
                moreText="question types"
              />
            </div>

            {/* Action Upload Widget */}
            {/* <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
              <div className="flex flex-col gap-0.5 w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                />
                <Label className="text-xs font-semibold invisible">Upload</Label>
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={!departmentId || !positionId || isUploading}
                  className="w-full h-11 bg-input/20 hover:bg-input/30 text-sm rounded-xl px-3 justify-center font-normal text-foreground inline-flex items-center cursor-pointer transition-all border border-border/50 outline-none focus:border-border/50 gap-1.5 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </PermissionGuard> */}
          </div>
        </div>

        {/* Question Form Card */}
        <div className="app-surface-card space-y-2 p-2">
          <div className="flex flex-col gap-2">
            {/* Dynamic fields based on Question Type */}
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
          </div>
        </div>

        {/* Skills Selector Card */}
        <div className="app-surface-card space-y-2 p-2">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Associated Tech Stack Skills <Required /></Label>
            <div className="w-full">
              <Form {...form}>
                <QuestionsBankSkillSelector
                  initialSelectedSkills={paperToEdit?.skills || []}
                  placeholderMessage="Select stacks/skills to link to this question bank."
                />
              </Form>
            </div>

          </div>
        </div>

        {/* Form Actions */}
        <div className="flex flex-wrap items-center justify-center gap-2 border-t pt-2">
          <Button
            onClick={handleSavePaper}
            disabled={createPaperMutation.isPending || isUploading}
            className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md hover:shadow-lg transition-all"
          >
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? "Save Changes" : createPaperMutation.isPending ? "Creating..." : "Create New Question"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard/questions-bank")}
            disabled={createPaperMutation.isPending || isUploading}
            className="rounded-xl font-semibold"
          >
            Cancel
          </Button>
        </div>
      </div>
    </AppPageShell>
  );
}
