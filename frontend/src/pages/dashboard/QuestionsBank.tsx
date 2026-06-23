import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { useQuestionSetPapers } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useUploadQuestionSetPaperMutation,
  useAddQuestionToPaperMutation,
  useUpdateQuestionInPaperMutation,
  useDeleteQuestionFromPaperMutation,
  useAddProjectTaskToPaperMutation,
  useUpdateProjectTaskInPaperMutation,
  useDeleteProjectTaskFromPaperMutation,
  useAddMCQToPaperMutation,
  useUpdateMCQInPaperMutation,
  useDeleteMCQFromPaperMutation,
  useCreateQuestionSetPaperMutation
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { LoadingSpinner, DataTable } from "@/components/shared";
import { useDebouncedValue } from "@/hooks";
import { extractErrorMessage } from "@/utils/error";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import type { MCQItem, TaskItem } from "@/types/taskPaper";

// Sub-components
import { QuestionsBankFilters } from "@/components/questions-bank/QuestionsBankFilters";
import { QuestionsBankSkills } from "@/components/questions-bank/QuestionsBankSkills";
import { QuestionsBankModals } from "@/components/questions-bank/QuestionsBankModals";
import { getQuestionsBankColumns, type FlatItem } from "@/components/questions-bank/QuestionsBankColumns";

export default function QuestionsBank() {
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [deptSearch, setDeptSearch] = useState<string>("");

  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [selectedContentType, setSelectedContentType] = useState<string>("all");

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch positions for filters
  const { data: positions, loading: loadingPositions } = useJobPosition(0, 100);

  const handleUploadClick = useCallback(() => {
    if (!selectedDeptId) {
      toast.error("Please select a department first.");
      return;
    }
    if (!selectedPositionId) {
      toast.error("Please select an experience/position level first.");
      return;
    }
    fileInputRef.current?.click();
  }, [selectedDeptId, selectedPositionId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({
        departmentId: selectedDeptId,
        positionId: selectedPositionId,
        skillIds: [],
        paperType: "mixed",
        file: file,
      });
      toast.success(`Successfully uploaded and triggered AI extraction for '${file.name}'!`);
      refetchPapers();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, `Failed to upload file.`));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Flatten the papers into a list of questions, project tasks, and MCQs
  const flatItems = useMemo(() => {
    const items: FlatItem[] = [];
    if (!questionPapers || !Array.isArray(questionPapers)) return items;

    questionPapers.forEach((paper) => {
      const paperId = paper.id || "";

      // 1. questions
      if (Array.isArray(paper.questions)) {
        paper.questions.forEach((q: string, idx: number) => {
          if (q && typeof q === "string") {
            items.push({
              id: `${paperId}-q-${idx}`,
              content: q,
              type: "question",
              paperId,
              itemIndex: idx,
              rawData: q,
              paperName: paper.name,
            });
          }
        });
      }

      // 2. project_task
      if (Array.isArray(paper.project_task)) {
        paper.project_task.forEach((task: any, idx: number) => {
          if (task) {
            const taskContent = typeof task === "string" ? task : (task.task || task.instructions || "");
            if (taskContent) {
              items.push({
                id: `${paperId}-t-${idx}`,
                content: taskContent,
                type: "project_task",
                paperId,
                itemIndex: idx,
                rawData: task,
                paperName: paper.name,
              });
            }
          }
        });
      }

      // 3. mcqs
      if (Array.isArray(paper.mcqs)) {
        paper.mcqs.forEach((mcq: any, idx: number) => {
          if (mcq) {
            const mcqContent = typeof mcq === "string" ? mcq : (mcq.question || "");
            if (mcqContent) {
              items.push({
                id: `${paperId}-m-${idx}`,
                content: mcqContent,
                type: "mcq",
                paperId,
                itemIndex: idx,
                rawData: mcq,
                paperName: paper.name,
              });
            }
          }
        });
      }
    });

    return items;
  }, [questionPapers]);

  // Client-side filtering by content type
  const filteredFlatItems = useMemo(() => {
    if (selectedContentType === "all") {
      return flatItems;
    }
    return flatItems.filter((item) => item.type === selectedContentType);
  }, [flatItems, selectedContentType]);

  // Modal states and handlers
  const [activeModal, setActiveModal] = useState<"question" | "mcq" | "task" | "delete" | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedItem, setSelectedItem] = useState<FlatItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Mutation Hooks
  const addQuestionMutation = useAddQuestionToPaperMutation();
  const updateQuestionMutation = useUpdateQuestionInPaperMutation();
  const deleteQuestionMutation = useDeleteQuestionFromPaperMutation();

  const addProjectTaskMutation = useAddProjectTaskToPaperMutation();
  const updateProjectTaskMutation = useUpdateProjectTaskInPaperMutation();
  const deleteProjectTaskMutation = useDeleteProjectTaskFromPaperMutation();

  const addMCQMutation = useAddMCQToPaperMutation();
  const updateMCQMutation = useUpdateMCQInPaperMutation();
  const deleteMCQMutation = useDeleteMCQFromPaperMutation();

  const createPaperMutation = useCreateQuestionSetPaperMutation();

  const handleEditClick = useCallback((item: FlatItem) => {
    setSelectedItem(item);
    setModalMode("edit");
    if (item.type === "question") {
      setActiveModal("question");
    } else if (item.type === "project_task") {
      setActiveModal("task");
    } else if (item.type === "mcq") {
      setActiveModal("mcq");
    }
  }, []);

  const handleDeleteClick = useCallback((item: FlatItem) => {
    setSelectedItem(item);
    setActiveModal("delete");
  }, []);

  const handleCloseModals = useCallback(() => {
    setActiveModal(null);
    setSelectedItem(null);
  }, []);

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const { paperId, itemIndex, type } = selectedItem;
      if (type === "question") {
        await deleteQuestionMutation.mutateAsync({ paperId, index: itemIndex });
      } else if (type === "project_task") {
        await deleteProjectTaskMutation.mutateAsync({ paperId, index: itemIndex });
      } else if (type === "mcq") {
        await deleteMCQMutation.mutateAsync({ paperId, index: itemIndex });
      }
      toast.success("Item deleted successfully.");
      refetchPapers();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to delete item."));
    } finally {
      setIsSaving(false);
      setActiveModal(null);
      setSelectedItem(null);
    }
  };

  const handleSaveQuestion = async (content: string) => {
    setIsSaving(true);
    try {
      if (modalMode === "add") {
        const firstPaper = questionPapers[0];
        if (firstPaper) {
          await addQuestionMutation.mutateAsync({ paperId: firstPaper.id, question: content });
        } else {
          await createPaperMutation.mutateAsync({
            department_id: selectedDeptId,
            position_id: selectedPositionId,
            skill_ids: [],
            paper_type: "normal",
            questions: [content],
            project_task: [],
            mcqs: [],
          });
        }
        toast.success("Question added successfully.");
      } else if (modalMode === "edit" && selectedItem) {
        await updateQuestionMutation.mutateAsync({
          paperId: selectedItem.paperId,
          index: selectedItem.itemIndex,
          question: content,
        });
        toast.success("Question updated successfully.");
      }
      refetchPapers();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to save question."));
    } finally {
      setIsSaving(false);
      setActiveModal(null);
      setSelectedItem(null);
    }
  };

  const handleSaveProjectTask = async (content: TaskItem) => {
    setIsSaving(true);
    try {
      if (modalMode === "add") {
        const firstPaper = questionPapers[0];
        if (firstPaper) {
          await addProjectTaskMutation.mutateAsync({ paperId: firstPaper.id, projectTask: content });
        } else {
          await createPaperMutation.mutateAsync({
            department_id: selectedDeptId,
            position_id: selectedPositionId,
            skill_ids: [],
            paper_type: "task",
            questions: [],
            project_task: [content],
            mcqs: [],
          });
        }
        toast.success("Project task added successfully.");
      } else if (modalMode === "edit" && selectedItem) {
        await updateProjectTaskMutation.mutateAsync({
          paperId: selectedItem.paperId,
          index: selectedItem.itemIndex,
          projectTask: content,
        });
        toast.success("Project task updated successfully.");
      }
      refetchPapers();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to save project task."));
    } finally {
      setIsSaving(false);
      setActiveModal(null);
      setSelectedItem(null);
    }
  };

  const handleSaveMCQ = async (mcq: MCQItem) => {
    setIsSaving(true);
    try {
      if (modalMode === "add") {
        const firstPaper = questionPapers[0];
        if (firstPaper) {
          await addMCQMutation.mutateAsync({ paperId: firstPaper.id, mcq });
        } else {
          await createPaperMutation.mutateAsync({
            department_id: selectedDeptId,
            position_id: selectedPositionId,
            skill_ids: [],
            paper_type: "mcq",
            questions: [],
            project_task: [],
            mcqs: [mcq],
          });
        }
        toast.success("MCQ added successfully.");
      } else if (modalMode === "edit" && selectedItem) {
        await updateMCQMutation.mutateAsync({
          paperId: selectedItem.paperId,
          index: selectedItem.itemIndex,
          mcq,
        });
        toast.success("MCQ updated successfully.");
      }
      refetchPapers();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to save MCQ."));
    } finally {
      setIsSaving(false);
      setActiveModal(null);
      setSelectedItem(null);
    }
  };

  const handleAddDropdownSelect = useCallback((type: "question" | "project_task" | "mcq") => {
    setModalMode("add");
    setSelectedItem(null);
    if (type === "question") {
      setActiveModal("question");
    } else if (type === "project_task") {
      setActiveModal("task");
    } else if (type === "mcq") {
      setActiveModal("mcq");
    }
  }, []);

  const columns = useMemo(
    () => getQuestionsBankColumns({
      onEdit: handleEditClick,
      onDelete: handleDeleteClick,
    }),
    [handleEditClick, handleDeleteClick]
  );

  const firstPaper = questionPapers[0];

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500 bg-background min-h-screen">
      <AppPageHeader title="Questions Bank" />

      <div className="space-y-2">
        {/* Top Control Bar */}
        <QuestionsBankFilters
          selectedDeptId={selectedDeptId}
          setSelectedDeptId={setSelectedDeptId}
          departments={departments}
          loadingDepts={loadingDepts}
          isDeptSearching={isDeptSearching}
          handleDeptSearch={handleDeptSearch}
          selectedPositionId={selectedPositionId}
          setSelectedPositionId={setSelectedPositionId}
          positions={positions}
          loadingPositions={loadingPositions}
          selectedContentType={selectedContentType}
          setSelectedContentType={setSelectedContentType}
          isUploading={isUploading}
          handleUploadClick={handleUploadClick}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          handleAddDropdownSelect={handleAddDropdownSelect}
        />

        {/* Loading papers state / DataTable */}
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
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            <DataTable
              columns={columns}
              data={filteredFlatItems}
              loading={loadingPapers}
              searchKey="content"
              searchPlaceholder="Filter by content..."
              emptyMessage="No questions, tasks, or MCQs found."
              totalRecords={filteredFlatItems.length}
              entityName="Items"
            />

            {/* Reactive Skills Accordion */}
            {firstPaper && (
              <QuestionsBankSkills
                firstPaper={firstPaper}
                refetchPapers={refetchPapers}
              />
            )}
          </div>
        )}
      </div>

      {/* Interactive Modals */}
      <QuestionsBankModals
        activeModal={activeModal}
        modalMode={modalMode}
        selectedItem={selectedItem}
        isSaving={isSaving}
        handleClose={handleCloseModals}
        handleSaveQuestion={handleSaveQuestion}
        handleSaveProjectTask={handleSaveProjectTask}
        handleSaveMCQ={handleSaveMCQ}
        handleConfirmDelete={handleConfirmDelete}
      />
    </AppPageShell>
  );
}
