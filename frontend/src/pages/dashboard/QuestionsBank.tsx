import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Upload, Plus } from "lucide-react";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { useQuestionSetPapers } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useUploadQuestionSetPaperMutation,
  useDeleteQuestionSetPaperMutation,
  useCreateQuestionSetPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, SearchableSelect } from "@/components/shared";
import { Label, Input } from "@/components";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks";
import type { MCQItem } from "@/types/taskPaper";
import { QuestionsList } from "@/components/candidate/projectSubmission/QuestionsList";
import { extractErrorMessage } from "@/utils/error";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
// import { useSkill } from "@/hooks/queries/admin/useSkill";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function QuestionsBank() {
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: {
      skill_ids: [] as string[],
    },
  });

  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [deptSearch, setDeptSearch] = useState<string>("");

  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  // const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [selectedPaperType, setSelectedPaperType] = useState<string>("");

  const paperTypeOptions = [
    { id: "normal", label: "Normal Questions" },
    { id: "mcq", label: "MCQ Questions" },
    { id: "task", label: "Project Task" },
  ];

  // Debounce search query for backend API calls
  const debouncedDeptSearch = useDebouncedValue(deptSearch);

  // Fetch departments list
  const { data: departments, loading: loadingDepts } = useDepartment(0, 100, debouncedDeptSearch);
  const isDeptSearching = deptSearch !== debouncedDeptSearch;
  const handleDeptSearch = useCallback((query: string) => setDeptSearch(query), []);

  useEffect(() => {
    if (departments.length > 0 && !selectedDeptId) {
      setSelectedDeptId(departments[0].id);
    }
  }, [departments, selectedDeptId]);

  // Fetch predefined Question Set Papers with polling if any paper is still extracting questions
  const {
    data: questionPapers = [],
    loading: loadingPapers,
    refetch: refetchPapers,
  } = useQuestionSetPapers({
    departmentId: selectedDeptId || undefined,
    positionId: selectedPositionId || undefined,
    // skillId: selectedSkillId || undefined,
    paperType: selectedPaperType || undefined,
    options: {
      enabled: !!selectedDeptId,
      refetchInterval: (query: unknown) => {
        // @ts-expect-error type checking compatibility
        const papers = (query as { state?: { data?: { questions?: string[] }[] }[] })?.state?.data;
        const hasProcessing = Array.isArray(papers) && papers.some(
          (paper) => !paper.questions || paper.questions.length === 0
        );
        return hasProcessing ? 15000 : false;
      }
    }
  });

  // Mutations for templates/papers
  const uploadMutation = useUploadQuestionSetPaperMutation();
  const deleteMutation = useDeleteQuestionSetPaperMutation();

  // Upload dialog states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadPositionId, setUploadPositionId] = useState("");
  const [uploadSkillId, setUploadSkillId] = useState("");
  const [uploadPaperType, setUploadPaperType] = useState<"normal" | "mcq" | "task">("normal");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Fetch positions & skills for filters & upload modal selection
  const { data: positions, loading: loadingPositions } = useJobPosition(0, 100);

  // const [skillSearch, setSkillSearch] = useState<string>("");
  // const debouncedSkillSearch = useDebouncedValue(skillSearch);
  // const { data: skills, loading: loadingSkills } = useSkill(0, 100, debouncedSkillSearch);
  // const isSkillSearching = skillSearch !== debouncedSkillSearch;
  // const handleSkillSearch = useCallback((query: string) => setSkillSearch(query), []);


  const handleUploadSubmit = async () => {
    if (!selectedDeptId) {
      toast.error("Please select a department first.");
      return;
    }
    if (!uploadPositionId) {
      toast.error("Please select a position level.");
      return;
    }
    if (!uploadFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({
        departmentId: selectedDeptId,
        positionId: uploadPositionId,
        skillIds: uploadSkillId ? [uploadSkillId] : [],
        paperType: uploadPaperType,
        file: uploadFile,
      });
      toast.success(`Successfully uploaded and triggered AI extraction for '${uploadFile.name}'!`);
      refetchPapers();
      setIsUploadOpen(false);
      // Reset upload inputs
      setUploadFile(null);
      setUploadPositionId("");
      setUploadSkillId("");
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, `Failed to upload file.`));
    } finally {
      setIsUploading(false);
    }
  };

  const [localPapers, setLocalPapers] = useState<any[]>([]);

  useEffect(() => {
    setLocalPapers(questionPapers);
  }, [questionPapers]);

  const handleAddQuestion = (text: string) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          return {
            ...paper,
            questions: [...(paper.questions || []), text],
          };
        }
        return paper;
      })
    );
  };

  const handleUpdateQuestion = (index: number, text: string) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          const nextQuestions = [...(paper.questions || [])];
          nextQuestions[index] = text;
          return { ...paper, questions: nextQuestions };
        }
        return paper;
      })
    );
  };

  const handleDeleteQuestion = (index: number) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          const nextQuestions = [...(paper.questions || [])];
          nextQuestions.splice(index, 1);
          return { ...paper, questions: nextQuestions };
        }
        return paper;
      })
    );
  };

  const handleAddMCQ = (mcq: MCQItem) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          return {
            ...paper,
            mcqs: [...(paper.mcqs || []), mcq],
          };
        }
        return paper;
      })
    );
  };

  const handleUpdateMCQ = (index: number, mcq: MCQItem) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          const nextMCQs = [...(paper.mcqs || [])];
          nextMCQs[index] = mcq;
          return { ...paper, mcqs: nextMCQs };
        }
        return paper;
      })
    );
  };

  const handleDeleteMCQ = (index: number) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          const nextMCQs = [...(paper.mcqs || [])];
          nextMCQs.splice(index, 1);
          return { ...paper, mcqs: nextMCQs };
        }
        return paper;
      })
    );
  };

  const handleAddTask = (text: string) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          return {
            ...paper,
            project_task: [...(paper.project_task || []), text],
          };
        }
        return paper;
      })
    );
  };

  const handleUpdateTask = (index: number, text: string) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          const nextTasks = [...(paper.project_task || [])];
          nextTasks[index] = text;
          return { ...paper, project_task: nextTasks };
        }
        return paper;
      })
    );
  };

  const handleDeleteTask = (index: number) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          const nextTasks = [...(paper.project_task || [])];
          nextTasks.splice(index, 1);
          return { ...paper, project_task: nextTasks };
        }
        return paper;
      })
    );
  };

  const handleUpdateSkills = (skills: string[]) => {
    setLocalPapers((prev) =>
      prev.map((paper, idx) => {
        if (idx === 0) {
          return { ...paper, task_skills: skills };
        }
        return paper;
      })
    );
  };

  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const createPaperMutation = useCreateQuestionSetPaperMutation();

  const isPaperDirty =
    localPapers.length > 0 &&
    questionPapers.length > 0 &&
    JSON.stringify(localPapers[0]) !== JSON.stringify(questionPapers[0]);

  const handleSaveChanges = async () => {
    if (localPapers.length === 0 || questionPapers.length === 0) return;
    setIsSavingChanges(true);

    const originalPaper = questionPapers[0];
    const updatedPaper = localPapers[0];

    try {
      // 1. Delete original paper
      await deleteMutation.mutateAsync(originalPaper.id);

      // 2. Re-create with updated values
      const payload = {
        department_id: updatedPaper.department_id,
        position_id: updatedPaper.position_id,
        skill_ids: updatedPaper.skills?.map((s: any) => s.id) || [],
        paper_type: updatedPaper.paper_type,
        questions: updatedPaper.questions,
        mcqs: updatedPaper.mcqs || [],
        project_task: updatedPaper.project_task,
      };

      await createPaperMutation.mutateAsync(payload);
      toast.success("Successfully updated question paper template!");
      refetchPapers();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to save paper changes."));
    } finally {
      setIsSavingChanges(false);
    }
  };

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500 bg-background min-h-screen">
      <AppPageHeader title="Questions Bank" />

      <div className="space-y-2">
        {/* Top Control Bar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 rounded-xl border border-border bg-card p-2 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 flex-1">
            {/* Department Selector */}
            <div className="flex flex-col gap-0.5 w-full">
              <Label className="text-xs font-semibold">Select Department</Label>
              <SearchableSelect
                value={selectedDeptId}
                onValueChange={setSelectedDeptId}
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

            {/* Experience / Position Level Selector */}
            <div className="flex flex-col gap-0.5 w-full">
              <Label className="text-xs font-semibold">Experience / Position Level</Label>
              <SearchableSelect
                value={selectedPositionId}
                onValueChange={setSelectedPositionId}
                options={positions?.map((pos) => ({ id: pos.id, label: pos.name })) || []}
                placeholder="All position levels"
                searchPlaceholder="Search position levels..."
                disabled={loadingPositions}
                loading={loadingPositions}
                loadingPlaceholder="Loading positions..."
                emptyMessage="No position levels found"
                moreText="position levels"
                onClear={() => setSelectedPositionId("")}
                clearLabel="Clear position filter"
              />
            </div>
            {/* Skill Selector */}
            {/* <div className="flex flex-col gap-0.5 w-full">
              <Label className="text-xs font-semibold">Skill Filter</Label>
              <SearchableSelect
                value={selectedSkillId}
                onValueChange={setSelectedSkillId}
                options={skills?.map((s) => ({ id: s.id, label: s.name })) || []}
                placeholder="All skills"
                searchPlaceholder="Search skills..."
                disabled={loadingSkills}
                loading={loadingSkills}
                loadingPlaceholder="Loading skills..."
                emptyMessage="No skills found"
                moreText="skills"
                onClear={() => setSelectedSkillId("")}
                clearLabel="Clear skill filter"
                onSearch={handleSkillSearch}
                asyncLoading={isSkillSearching}
              />
            </div> */}


            {/* Paper Type Selector */}
            <div className="flex flex-col gap-0.5 w-full">
              <Label className="text-xs font-semibold">Paper Type</Label>
              <SearchableSelect
                value={selectedPaperType}
                onValueChange={setSelectedPaperType}
                options={paperTypeOptions}
                placeholder="All paper types"
                searchPlaceholder="Search paper types..."
                emptyMessage="No paper types found"
                onClear={() => setSelectedPaperType("")}
                clearLabel="Clear paper type filter"
              />
            </div>
          </div>

          {/* Action Upload Widget */}
          <div className="flex items-end justify-end shrink-0 gap-2 xl:self-end">
            <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
              <Button
                onClick={() => setIsUploadOpen(true)}
                disabled={!selectedDeptId || isUploading}
                variant="outline"
                className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-11"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload new set
              </Button>
              <Button
                onClick={() => navigate("/dashboard/questions-bank/new", {
                  state: {
                    departmentId: selectedDeptId,
                    positionId: selectedPositionId
                  }
                })}
                disabled={!selectedDeptId}
                className="rounded-xl px-5 font-semibold text-center h-11"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </PermissionGuard>
          </div>
        </div>

        {/* Loading papers state */}
        {!selectedPositionId ? (
          <div className="animate-in fade-in duration-300">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="text-center py-10 border border-dashed border-border/60 rounded-2xl bg-card/10 text-muted-foreground w-full">
                <p className="font-semibold text-foreground/80">Position Level Required</p>
                <p className="text-sm mt-1 max-w-md mx-auto">
                  Kindly select a position level first to view and manage the question set papers.
                </p>
              </div>
            </div>
          </div>
        ) : loadingPapers ? (
          <LoadingSpinner message="Loading question set papers..." />
        ) : questionPapers.length === 0 ? (
          <div className="animate-in fade-in duration-300">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="text-center py-10 border border-dashed border-border/60 rounded-2xl bg-card/10 text-muted-foreground w-full">
                <p className="font-semibold text-foreground/80">No Question Set Papers Found</p>
                <p className="text-sm mt-1 max-w-md mx-auto">
                  There are no predefined question set papers for the selected department.
                  Upload a document or manually define questions.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Questions List */}
            {localPapers.length > 0 && (
              <QuestionsList
                paper={localPapers[0]}
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
            )}

            {/* Save / Discard panel */}
            {isPaperDirty && (
              <div className="flex items-center justify-end gap-3 p-3 bg-muted/40 rounded-2xl border border-border/80 fade-in slide-in-from-bottom-2">
                <span className="text-xs font-semibold text-muted-foreground mr-auto">
                  You have unsaved changes in this template.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalPapers(JSON.parse(JSON.stringify(questionPapers)))}
                  disabled={isSavingChanges}
                  className="rounded-xl"
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveChanges}
                  isLoading={isSavingChanges}
                  disabled={isSavingChanges}
                  className="rounded-xl font-bold"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-background border border-border shadow-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Upload Question Set Paper</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Department (Read-only) */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">Department</Label>
              <Input
                value={departments.find((d) => d.id === selectedDeptId)?.name || ""}
                disabled
                className="bg-muted text-muted-foreground rounded-xl h-10"
              />
            </div>

            {/* Position Level */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">Select Experience / Position Level</Label>
              <SearchableSelect
                value={uploadPositionId}
                onValueChange={setUploadPositionId}
                options={positions?.map((pos) => ({ id: pos.id, label: pos.name })) || []}
                placeholder="Choose a position level..."
                searchPlaceholder="Search levels..."
                emptyMessage="No position levels found"
                moreText="position levels"
              />
            </div>
            {/* Paper Type */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">Select Paper Type</Label>
              <SearchableSelect
                value={uploadPaperType}
                onValueChange={(val) => setUploadPaperType(val as any)}
                options={[
                  { id: "normal", label: "Normal Questions" },
                  { id: "mcq", label: "MCQ Questions" },
                  { id: "task", label: "Project Task" },
                ]}
                placeholder="Choose paper type..."
                searchPlaceholder="Search paper types..."
              />
            </div>

            {/* File Selector */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">File (.pdf, .doc, .docx)</Label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                }}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadOpen(false);
                setUploadFile(null);
                setUploadPositionId("");
                setUploadSkillId("");
              }}
              disabled={isUploading}
              className="rounded-xl h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={isUploading || !uploadPositionId || !uploadFile}
              className="rounded-xl h-10 font-bold bg-primary text-primary-foreground hover:bg-primary/95"
            >
              {isUploading ? "Uploading..." : "Upload & Extract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
