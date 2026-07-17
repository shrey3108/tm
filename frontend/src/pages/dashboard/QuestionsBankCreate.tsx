/**
 * @module QuestionsBankCreate
 * @component QuestionsBankCreate
 *
 * Creation form for adding new questions with options and test cases to the Questions Bank.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { usePageFilters } from "@/hooks/usePageFilters";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { QuestionsBankSkillSelector } from "@/components/questions-bank/QuestionsBankSkillSelector";
import { Form } from "@/components/ui/form";
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
  const skillForm = useForm({
    defaultValues: {
      skill_ids: [] as string[],
    },
  });

  const selectedSkillIds = skillForm.watch("skill_ids") || [];

  // Single-Question Form state
  const [contentType, setContentType] = useState<"question" | "mcq" | "project_task">(
    initialItemType || "question"
  );
  const itemIndex = useMemo(() => {
    return initialItemIndex !== undefined ? Number(initialItemIndex) : 0;
  }, [initialItemIndex]);

  // Form Hooks
  const questionForm = useForm({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      question: "",
      marks: "",
      hours: "", // use 0 as default value
      minutes: "",
    },
  });

  const mcqForm = useForm({
    resolver: zodResolver(mcqFormSchema),
    defaultValues: {
      question: "",
      options: ["", ""],
      answer: "",
      marks: "",
      hours: "",
      minutes: "",
    },
  });

  const projectTaskForm = useForm({
    resolver: zodResolver(projectTaskSchema),
    defaultValues: {
      project_task: "",
      instructions: "",
      hours: "",
      minutes: "",
      tasks: [],
    },
  });

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
          const rawOptions = mcq.options || [];
          const answerText = mcq.answer || "";
          const answerIndex = rawOptions.indexOf(answerText);
          const answerLetter = answerIndex !== -1 ? String.fromCharCode(65 + answerIndex) : "A";
          const mDur = mcq.duration || 0;
          mcqForm.reset({
            question: mcq.question || "",
            options: rawOptions,
            answer: answerLetter,
            marks: mcq.marks || "",
            hours: Math.floor(mDur / 60) || "",
            minutes: mDur % 60 || "",
          });
          if (mcq.skill_ids && mcq.skill_ids.length > 0) {
            itemSkillIds = mcq.skill_ids;
          }
        } else if (initialItemType === "project_task" && paperToEdit.project_task && paperToEdit.project_task[itemIndex]) {
          const task = paperToEdit.project_task[itemIndex];
          const dur = task?.duration || task?.total_duration || 0;
          projectTaskForm.reset({
            project_task: task?.task || "",
            instructions: task?.instructions || "",
            hours: Math.floor(dur / 60) || "",
            minutes: dur % 60 || "",
            tasks: task?.tasks || [],
          });
          if (task?.skill_ids && task?.skill_ids.length > 0) {
            itemSkillIds = task.skill_ids;
          }
        } else if (initialItemType === "question" && paperToEdit.questions && paperToEdit.questions[itemIndex]) {
          const q = paperToEdit.questions[itemIndex];
          const qDur = q?.duration || 0;
          questionForm.reset({
            question: q?.question || "",
            marks: q?.marks || "",
            hours: Math.floor(qDur / 60) || "",
            minutes: qDur % 60 || "",
          });
          if (q?.skill_ids && q?.skill_ids.length > 0) {
            itemSkillIds = q.skill_ids;
          }
        }
      } else {
        if (paperToEdit.mcqs && paperToEdit.mcqs.length > 0) {
          setContentType("mcq");
          const mcq = paperToEdit.mcqs[0];
          const rawOptions = mcq.options || [];
          const answerText = mcq.answer || "";
          const answerIndex = rawOptions.indexOf(answerText);
          const answerLetter = answerIndex !== -1 ? String.fromCharCode(65 + answerIndex) : "A";
          const mDur = mcq.duration || 0;
          mcqForm.reset({
            question: mcq.question || "",
            options: rawOptions,
            answer: answerLetter,
            marks: mcq.marks || "",
            hours: Math.floor(mDur / 60) || "",
            minutes: mDur % 60 || "",
          });
        } else if (paperToEdit.project_task && paperToEdit.project_task.length > 0) {
          setContentType("project_task");
          const task = paperToEdit.project_task[0];
          const dur = task?.duration || task?.total_duration || 0;
          projectTaskForm.reset({
            project_task: task?.task || "",
            instructions: task?.instructions || "",
            hours: Math.floor(dur / 60) || "",
            minutes: dur % 60 || "",
            tasks: task?.tasks || [],
          });
        } else {
          setContentType("question");
          const q = paperToEdit.questions?.[0];
          if (q) {
            const qDur = q?.duration || 0;
            questionForm.reset({
              question: q?.question || "",
              marks: q?.marks || "",
              hours: Math.floor(qDur / 60) || "",
              minutes: qDur % 60 || "",
            });
          }
        }
      }

      skillForm.reset({ skill_ids: itemSkillIds });
    }
  }, [isEditMode, paperToEdit, skillForm, initialItemType, itemIndex]);

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
    }

    // Validate content based on selected type
    let questionTextPayload: QuestionItem = { question: "" };
    if (contentType === "question") {
      const isValid = await questionForm.trigger();
      if (!isValid) return;

      const values = questionForm.getValues();
      const qHours = values.hours === "" ? 0 : Number(values.hours);
      const qMins = values.minutes === "" ? 0 : Number(values.minutes);
      const duration = qHours * 60 + qMins;

      questionTextPayload = {
        question: values.question.trim(),
        marks: Number(values.marks),
        duration,
        skill_ids: selectedSkillIds,
      };
    }

    let mcqItemPayload: MCQItem | null = null;
    if (contentType === "mcq") {
      const isValid = await mcqForm.trigger();
      if (!isValid) return;

      const values = mcqForm.getValues();
      const mHours = values.hours === "" ? 0 : Number(values.hours);
      const mMins = values.minutes === "" ? 0 : Number(values.minutes);
      const duration = mHours * 60 + mMins;

      const answerIndex = values.answer.charCodeAt(0) - 65;
      const answerText = (values.options as any[])[answerIndex] || "";

      mcqItemPayload = {
        question: values.question.trim(),
        options: (values.options as any[]).map((opt: any) => opt.trim()),
        answer: answerText.trim(),
        marks: Number(values.marks),
        duration,
        skill_ids: selectedSkillIds,
      };
    }

    let projectTaskItemPayload: TaskItem | null = null;
    if (contentType === "project_task") {
      const isValid = await projectTaskForm.trigger();
      if (!isValid) return;

      const values = projectTaskForm.getValues();
      const duration = (Number(values.hours) || 0) * 60 + (Number(values.minutes) || 0);

      projectTaskItemPayload = {
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
          </div>
        </div>

        {/* Skills Selector Card */}
        <div className="app-surface-card space-y-2 p-2">
          <div className="space-y-1">
            <div className="w-full">
              <Form {...skillForm}>
                <QuestionsBankSkillSelector
                  initialSelectedSkills={paperToEdit?.skills || []}
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
