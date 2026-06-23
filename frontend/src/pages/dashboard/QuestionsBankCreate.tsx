import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QuestionsList } from "@/components/candidate/projectSubmission/QuestionsList";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { SearchableSelect } from "@/components/shared";
import { useDebouncedValue } from "@/hooks";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { useCreateQuestionSetPaperMutation } from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import type { QuestionSetPaperRead, MCQItem, TaskItem } from "@/types/taskPaper";
import { extractErrorMessage } from "@/utils/error";

export default function QuestionsBankCreate() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get initial values from routing state if redirecting from main page
  const {
    departmentId: initialDeptId,
    positionId: initialPositionId,
  } = (location.state as any) || {};

  const [departmentId, setDepartmentId] = useState<string>(initialDeptId || "");
  const [positionId, setPositionId] = useState<string>(initialPositionId || "");
  const [deptSearch, setDeptSearch] = useState<string>("");

  const debouncedDeptSearch = useDebouncedValue(deptSearch);
  const isDeptSearching = deptSearch !== debouncedDeptSearch;
  const handleDeptSearch = useCallback((query: string) => setDeptSearch(query), []);

  // Fetch departments and positions
  const { data: departments, loading: loadingDepts } = useDepartment(0, 100, debouncedDeptSearch);
  const { data: positions, loading: loadingPositions } = useJobPosition(0, 100);

  const createPaperMutation = useCreateQuestionSetPaperMutation();

  // Setup React Hook Form to use SkillSelectorSection
  const form = useForm({
    defaultValues: {
      skill_ids: [] as string[],
    },
  });

  const selectedSkillIds = form.watch("skill_ids");

  // Local Paper state to keep track of designed questions/MCQs/tasks
  const [localPaper, setLocalPaper] = useState<QuestionSetPaperRead>({
    id: "new-paper",
    name: "New Question Set Paper",
    department_id: departmentId,
    position_id: positionId,
    skills: [],
    paper_type: "normal",
    questions: [],
    mcqs: [],
    project_task: [],
    task_file_path: null,
    task_skills: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Sync position and department IDs to localPaper
  useEffect(() => {
    setLocalPaper((prev) => ({
      ...prev,
      position_id: positionId,
      department_id: departmentId,
    }));
  }, [positionId, departmentId]);

  // QuestionsList Handlers updating local state
  const handleAddQuestion = (text: string) => {
    setLocalPaper((prev) => ({
      ...prev,
      questions: [...prev.questions, text],
    }));
  };

  const handleUpdateQuestion = (index: number, text: string) => {
    setLocalPaper((prev) => {
      const nextQuestions = [...prev.questions];
      nextQuestions[index] = text;
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleDeleteQuestion = (index: number) => {
    setLocalPaper((prev) => {
      const nextQuestions = [...prev.questions];
      nextQuestions.splice(index, 1);
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleAddMCQ = (mcq: MCQItem) => {
    setLocalPaper((prev) => ({
      ...prev,
      mcqs: [...(prev.mcqs || []), mcq],
    }));
  };

  const handleUpdateMCQ = (index: number, mcq: MCQItem) => {
    setLocalPaper((prev) => {
      const nextMCQs = [...(prev.mcqs || [])];
      nextMCQs[index] = mcq;
      return { ...prev, mcqs: nextMCQs };
    });
  };

  const handleDeleteMCQ = (index: number) => {
    setLocalPaper((prev) => {
      const nextMCQs = [...(prev.mcqs || [])];
      nextMCQs.splice(index, 1);
      return { ...prev, mcqs: nextMCQs };
    });
  };

  const handleAddTask = (text: TaskItem | string) => {
    setLocalPaper((prev) => ({
      ...prev,
      project_task: [...(prev.project_task || []), text],
    }));
  };

  const handleUpdateTask = (index: number, text: TaskItem | string) => {
    setLocalPaper((prev) => {
      const nextTasks = [...(prev.project_task || [])];
      nextTasks[index] = text;
      return { ...prev, project_task: nextTasks };
    });
  };

  const handleDeleteTask = (index: number) => {
    setLocalPaper((prev) => {
      const nextTasks = [...(prev.project_task || [])];
      nextTasks.splice(index, 1);
      return { ...prev, project_task: nextTasks };
    });
  };

  const handleUpdateSkills = (skills: string[]) => {
    setLocalPaper((prev) => ({
      ...prev,
      task_skills: skills,
    }));
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

    const totalQuestions =
      localPaper.questions.length +
      (localPaper.mcqs?.length || 0) +
      localPaper.project_task.length;

    if (totalQuestions === 0) {
      toast.error("Please add at least one question, MCQ, or project task.");
      return;
    }

    // Determine the paper type based on what content is dominant
    let paperType: "normal" | "mcq" | "task" = "normal";
    if ((localPaper.mcqs?.length || 0) > 0) {
      paperType = "mcq";
    } else if (localPaper.project_task.length > 0) {
      paperType = "task";
    }

    try {
      const payload = {
        department_id: departmentId,
        position_id: positionId,
        skill_ids: selectedSkillIds,
        paper_type: paperType,
        questions: localPaper.questions,
        mcqs: localPaper.mcqs || [],
        project_task: localPaper.project_task,
      };

      await createPaperMutation.mutateAsync(payload);
      toast.success("Successfully created question paper template! Skills are being extracted in the background.");
      navigate("/dashboard/questions-bank");
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to create question set paper."));
    }
  };

  return (
    <AppPageShell
      width="wide"
      gap="default"
      className="animate-in fade-in duration-500 bg-background"
    >
      <PageHeader
        title="Define Question Paper"
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

      <div className="mx-auto w-full space-y-6">
        {/* Selection Form Card */}
        <div className="app-surface-card space-y-6 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Paper Association Details</h2>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Department */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">Department</Label>
              <SearchableSelect
                value={departmentId}
                onValueChange={setDepartmentId}
                options={departments?.map((dept) => ({ id: dept.id, label: dept.name })) || []}
                placeholder="Choose a department..."
                searchPlaceholder="Search departments..."
                disabled={!departments || departments.length === 0}
                loading={loadingDepts}
                loadingPlaceholder="Loading departments..."
                emptyMessage="No departments found"
                moreText="departments"
                onSearch={handleDeptSearch}
                asyncLoading={isDeptSearching}
              />
            </div>

            {/* Experience / Position Level */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">Experience / Position Level</Label>
              <SearchableSelect
                value={positionId}
                onValueChange={setPositionId}
                options={positions?.map((pos) => ({ id: pos.id, label: pos.name })) || []}
                placeholder="Choose experience / position level..."
                searchPlaceholder="Search position levels..."
                disabled={loadingPositions}
                loading={loadingPositions}
                loadingPlaceholder="Loading positions..."
                emptyMessage="No position levels found"
                moreText="position levels"
              />
            </div>
          </div>
        </div>

        {/* Questions Designer */}
        <div className="app-surface-card space-y-3 p-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Question Set</h2>

          </div>
          <QuestionsList
            paper={localPaper}
            onAddQuestion={handleAddQuestion}
            onUpdateQuestion={handleUpdateQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onAddMCQ={handleAddMCQ}
            onUpdateMCQ={handleUpdateMCQ}
            onDeleteMCQ={handleDeleteMCQ}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onUpdateSkills={handleUpdateSkills}
            form={form}
          />
        </div>

        {/* Form Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 border-t pt-8">
          <Button
            onClick={handleSavePaper}
            disabled={createPaperMutation.isPending}
            className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md hover:shadow-lg transition-all"
          >
            <Save className="h-4 w-4 mr-2" />
            {createPaperMutation.isPending ? "Creating..." : "Create Question Bank"}
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
