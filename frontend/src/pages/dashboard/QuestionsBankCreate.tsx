/**
 * @module QuestionsBankCreate
 * @component QuestionsBankCreate
 *
 * Creation form for adding new questions with options and test cases to the Questions Bank.
 */
import { useState, useReducer, useEffect, useCallback, useMemo } from "react";
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
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import type { MCQItem, TaskItem, QuestionItem } from "@/types/taskPaper";
import {
  questionReducer,
  questionInitialState,
  mcqReducer,
  mcqInitialState,
  projectTaskReducer,
  projectTaskInitialState,
} from "@/reducer/questionsBankReducers";
import { mcqFormSchema } from "@/schemas/taskPaper";
import { questionFormSchema, projectTaskSchema } from "@/schemas/question";
import { extractErrorMessage } from "@/utils/error";
import { slugify } from "@/utils/slug";

// Form field components
import { QuestionContentFormFields } from "@/components/questions-bank/QuestionContentFormFields";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { QuestionsBankFilters } from "@/components/questions-bank/QuestionsBankFilters";



export default function QuestionsBankCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();



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
  const { data: fetchedPaper, loading: loadingFetchedPaper } = useQuestionSetPaper(initialPaperId);
  const { data: allPapers = [], loading: loadingAllPapers } = useQuestionSetPapers({
    options: { enabled: isEditMode && !initialPaperId }
  });

  const paperToEdit = useMemo(() => {
    if (!isEditMode) return null;
    if (initialPaperId) return fetchedPaper;
    return allPapers.find((p) => slugify(p.name) === slug) || null;
  }, [isEditMode, initialPaperId, fetchedPaper, allPapers, slug]);

  const loadingPaper = isEditMode && (initialPaperId ? loadingFetchedPaper : loadingAllPapers);


  // Mutations
  const createPaperMutation = useCreateQuestionSetPaperMutation();
  const addQuestionMutation = useAddQuestionToPaperMutation();
  const updateQuestionMutation = useUpdateQuestionInPaperMutation();

  const addProjectTaskMutation = useAddProjectTaskToPaperMutation();
  const updateProjectTaskMutation = useUpdateProjectTaskInPaperMutation();

  const addMCQMutation = useAddMCQToPaperMutation();
  const updateMCQMutation = useUpdateMCQInPaperMutation();



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

  // Reducer-based state for each question type
  const [questionState, questionDispatch] = useReducer(questionReducer, questionInitialState);
  const [mcqState, mcqDispatch] = useReducer(mcqReducer, mcqInitialState);
  const [taskState, taskDispatch] = useReducer(projectTaskReducer, projectTaskInitialState);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Clear validation errors when changing content type or options length
  useEffect(() => {
    setErrors({});
  }, [contentType, mcqState.options.length]);

  // Sync backend paper state to local Form in Edit Mode
  useEffect(() => {
    if (isEditMode && paperToEdit) {
      setDepartmentId(paperToEdit.department_id || "");
      setPositionId(paperToEdit.position_id || "");

      let itemSkillIds = paperToEdit.skills?.map((s) => s.id) || paperToEdit.task_skills || [];

      /** Helper: build MCQ reducer state from an MCQItem */
      const resetMCQFromItem = (mcq: { question?: string; options?: string[]; answer?: string; marks?: number; duration?: number; skill_ids?: string[] }) => {
        const rawOptions = mcq.options || [];
        const answerText = mcq.answer || "";
        const answerIndex = rawOptions.indexOf(answerText);
        const answerLetter = answerIndex !== -1 ? String.fromCharCode(65 + answerIndex) : "A";
        const mDur = mcq.duration || 0;
        mcqDispatch({
          type: "RESET",
          payload: {
            question: mcq.question || "",
            options: rawOptions,
            answer: answerLetter,
            marks: mcq.marks || "",
            hours: Math.floor(mDur / 60) || "",
            minutes: mDur % 60 || "",
          },
        });
        if (mcq.skill_ids && mcq.skill_ids.length > 0) {
          itemSkillIds = mcq.skill_ids;
        }
      };

      /** Helper: build Project Task reducer state from a TaskItem or string */
      const resetTaskFromItem = (task: any) => {
        if (typeof task === "string") {
          taskDispatch({ type: "RESET", payload: { description: task, instructions: "", hours: "", minutes: "", tasks: [] } });
        } else {
          const dur = task?.duration || task?.total_duration || 0;
          taskDispatch({
            type: "RESET",
            payload: {
              description: task?.task || "",
              instructions: task?.instructions || "",
              hours: Math.floor(dur / 60) || "",
              minutes: dur % 60 || "",
              tasks: task?.tasks || [],
            },
          });
          if (task?.skill_ids && task?.skill_ids.length > 0) {
            itemSkillIds = task.skill_ids;
          }
        }
      };

      /** Helper: build Question reducer state from a QuestionItem or string */
      const resetQuestionFromItem = (q: any) => {
        if (typeof q === "string") {
          questionDispatch({ type: "RESET", payload: { text: q, marks: "", hours: "", minutes: "" } });
        } else {
          const qDur = q?.duration || 0;
          questionDispatch({
            type: "RESET",
            payload: {
              text: q?.question || "",
              marks: q?.marks || "",
              hours: Math.floor(qDur / 60) || "",
              minutes: qDur % 60 || "",
            },
          });
          if (q?.skill_ids && q?.skill_ids.length > 0) {
            itemSkillIds = q.skill_ids;
          }
        }
      };

      // Determine content type and pre-populate
      if (initialItemType) {
        setContentType(initialItemType);
        if (initialItemType === "mcq" && paperToEdit.mcqs && paperToEdit.mcqs[itemIndex]) {
          resetMCQFromItem(paperToEdit.mcqs[itemIndex]);
        } else if (initialItemType === "project_task" && paperToEdit.project_task && paperToEdit.project_task[itemIndex]) {
          resetTaskFromItem(paperToEdit.project_task[itemIndex]);
        } else if (initialItemType === "question" && paperToEdit.questions && paperToEdit.questions[itemIndex]) {
          resetQuestionFromItem(paperToEdit.questions[itemIndex]);
        }
      } else {
        if (paperToEdit.mcqs && paperToEdit.mcqs.length > 0) {
          setContentType("mcq");
          resetMCQFromItem(paperToEdit.mcqs[0]);
        } else if (paperToEdit.project_task && paperToEdit.project_task.length > 0) {
          setContentType("project_task");
          resetTaskFromItem(paperToEdit.project_task[0]);
        } else {
          setContentType("question");
          const q = paperToEdit.questions?.[0];
          if (q) {
            resetQuestionFromItem(q);
          } else {
            questionDispatch({ type: "RESET", payload: questionInitialState });
          }
        }
      }

      form.reset({ skill_ids: itemSkillIds });
    }
  }, [isEditMode, paperToEdit, form, initialItemType, itemIndex]);


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
      // return;
    }

    // Validate content based on selected type
    let questionTextPayload: QuestionItem | string = "";
    if (contentType === "question") {
      const qHours = questionState.hours === "" ? 0 : Number(questionState.hours);
      const qMins = questionState.minutes === "" ? 0 : Number(questionState.minutes);
      const duration = qHours * 60 + qMins;

      const result = questionFormSchema.safeParse({
        question: questionState.text,
        marks: questionState.marks === "" ? undefined : Number(questionState.marks),
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
        question: questionState.text.trim(),
        marks: Number(questionState.marks),
        duration,
        skill_ids: selectedSkillIds,
      };
    }

    let mcqItemPayload: MCQItem | null = null;
    if (contentType === "mcq") {
      const mHours = mcqState.hours === "" ? 0 : Number(mcqState.hours);
      const mMins = mcqState.minutes === "" ? 0 : Number(mcqState.minutes);
      const duration = mHours * 60 + mMins;

      const result = mcqFormSchema.safeParse({
        question: mcqState.question,
        options: mcqState.options,
        answer: mcqState.answer,
        marks: mcqState.marks === "" ? undefined : Number(mcqState.marks),
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

      const answerIndex = mcqState.answer.charCodeAt(0) - 65;
      const answerText = mcqState.options[answerIndex] || "";

      mcqItemPayload = {
        question: mcqState.question.trim(),
        options: mcqState.options.map((opt) => opt.trim()),
        answer: answerText.trim(),
        marks: Number(mcqState.marks),
        duration,
        skill_ids: selectedSkillIds,
      };
    }

    let projectTaskItemPayload: TaskItem | null = null;
    if (contentType === "project_task") {
      const result = projectTaskSchema.safeParse({
        project_task: taskState.description,
        instructions: taskState.instructions,
        hours: taskState.hours,
        minutes: taskState.minutes,
        tasks: taskState.tasks,
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

      const duration = (Number(taskState.hours) || 0) * 60 + (Number(taskState.minutes) || 0);

      projectTaskItemPayload = {
        task: taskState.description.trim(),
        instructions: taskState.instructions.trim(),
        title: taskState.description.trim(),
        description: taskState.description.trim(),
        duration,
        tasks: taskState.tasks.map((t) => ({
          name: t.name,
          description: t.description || undefined,
          marks: t.marks,
        })),
        total_marks: taskState.tasks.reduce((sum, t) => sum + (t.marks || 0), 0),
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
        <QuestionsBankFilters
          selectedDeptId={departmentId}
          setSelectedDeptId={setDepartmentId}
          departments={departments || null}
          loadingDepts={loadingDepts}
          isDeptSearching={isDeptSearching}
          handleDeptSearch={handleDeptSearch}
          selectedPositionId={positionId}
          setSelectedPositionId={setPositionId}
          positions={positions || null}
          loadingPositions={loadingPositions}
          selectedContentType={contentType}
          setSelectedContentType={(val) => setContentType(val as "question" | "mcq" | "project_task")}
          contentTypeOptions={typeOptions as any}
          hideSkills={true}
          hideActions={true}
          showRequired={true}
          disabled={isEditMode}
        />

        {/* Question Form Card */}
        <div className="app-surface-card space-y-2 p-2">
          <div className="flex flex-col gap-2">
            {/* Dynamic fields based on Question Type */}
            <QuestionContentFormFields
              contentType={contentType}
              questionState={questionState}
              questionDispatch={questionDispatch}
              mcqState={mcqState}
              mcqDispatch={mcqDispatch}
              taskState={taskState}
              taskDispatch={taskDispatch}
              errors={errors}
              onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: "" }))}
            />
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
            disabled={createPaperMutation.isPending}
            className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md hover:shadow-lg transition-all"
          >
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? "Save Changes" : createPaperMutation.isPending ? "Creating..." : "Create New Question"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard/questions-bank")}
            disabled={createPaperMutation.isPending}
            className="rounded-xl font-semibold"
          >
            Cancel
          </Button>
        </div>
      </div>
    </AppPageShell>
  );
}
