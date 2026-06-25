import { useState, useCallback, useEffect, useMemo } from "react";
import { usePageFilters } from "@/hooks/usePageFilters";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { useQuestionSetPapers } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useDeleteQuestionFromPaperMutation,
  useDeleteProjectTaskFromPaperMutation,
  useDeleteMCQFromPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { LoadingSpinner, DataTable } from "@/components/shared";
import { useDebouncedValue } from "@/hooks";
import { extractErrorMessage } from "@/utils/error";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { useSkill } from "@/hooks/queries/admin/useSkill";
import { slugify } from "@/utils/slug";

// Sub-components
import { QuestionsBankFilters } from "@/components/questions-bank/QuestionsBankFilters";
import { QuestionsBankModals } from "@/components/questions-bank/QuestionsBankModals";
import { getQuestionsBankColumns, type FlatItem } from "@/components/questions-bank/QuestionsBankColumns";

/** Default filter values for the QuestionsBank page. */
const questionsBankDefaults = {
  selectedDeptId: "",
  selectedPositionId: "",
  selectedSkillId: "",
  selectedContentType: "all",
};

export default function QuestionsBank() {
  const navigate = useNavigate();

  // Persisted filters via Redux + sessionStorage
  const { filters, setFilter } = usePageFilters("questionsBank", questionsBankDefaults);
  const { selectedDeptId, selectedPositionId, selectedSkillId, selectedContentType } = filters;

  // Transient search inputs (not persisted)
  const [deptSearch, setDeptSearch] = useState<string>("");
  const [skillSearch, setSkillSearch] = useState<string>("");

  // Debounce search query for backend API calls
  const debouncedDeptSearch = useDebouncedValue(deptSearch);
  const debouncedSkillSearch = useDebouncedValue(skillSearch);

  // Fetch departments list
  const { data: departments, loading: loadingDepts } = useDepartment(0, 100, debouncedDeptSearch);
  const isDeptSearching = deptSearch !== debouncedDeptSearch;
  const handleDeptSearch = useCallback((query: string) => setDeptSearch(query), []);

  // Fetch skills list
  const { data: skills, loading: loadingSkills } = useSkill(0, 100, debouncedSkillSearch);
  const isSkillSearching = skillSearch !== debouncedSkillSearch;
  const handleSkillSearch = useCallback((query: string) => setSkillSearch(query), []);

  useEffect(() => {
    if (departments.length > 0 && !selectedDeptId) {
      setFilter("selectedDeptId", departments[0].id);
    }
  }, [departments, selectedDeptId, setFilter]);

  // Fetch predefined Question Set Papers
  const {
    data: questionPapers = [],
    loading: loadingPapers,
    refetch: refetchPapers,
  } = useQuestionSetPapers({
    departmentId: selectedDeptId || undefined,
    positionId: selectedPositionId || undefined,
    skillId: selectedSkillId || undefined,
  });

  // Fetch positions for filters
  const { data: positions, loading: loadingPositions } = useJobPosition(0, 100);

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
              skills: paper.skills,
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
                skills: paper.skills,
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
                skills: paper.skills,
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

  // Modal states and handlers (only delete modal is kept)
  const [activeModal, setActiveModal] = useState<"delete" | null>(null);
  const [selectedItem, setSelectedItem] = useState<FlatItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Mutation Hooks
  const deleteQuestionMutation = useDeleteQuestionFromPaperMutation();
  const deleteProjectTaskMutation = useDeleteProjectTaskFromPaperMutation();
  const deleteMCQMutation = useDeleteMCQFromPaperMutation();

  const handleCreateNew = useCallback(() => {
    navigate("/dashboard/questions-bank/new");
  }, [navigate]);

  const handleEditClick = useCallback((item: FlatItem) => {
    const slug = slugify(item.paperName || "new-paper");
    navigate(`/dashboard/questions-bank/${slug}/edit`, {
      state: {
        paperId: item.paperId,
        itemIndex: item.itemIndex,
        itemType: item.type,
      },
    });
  }, [navigate]);

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

  const columns = useMemo(
    () => getQuestionsBankColumns({
      onEdit: handleEditClick,
      onDelete: handleDeleteClick,
    }),
    [handleEditClick, handleDeleteClick]
  );

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500 bg-background min-h-screen">
      <AppPageHeader title="Question Bank" />

      <div className="space-y-2">
        {/* Top Control Bar */}
        <QuestionsBankFilters
          selectedDeptId={selectedDeptId}
          setSelectedDeptId={(id) => setFilter("selectedDeptId", id)}
          departments={departments}
          loadingDepts={loadingDepts}
          isDeptSearching={isDeptSearching}
          handleDeptSearch={handleDeptSearch}
          selectedPositionId={selectedPositionId}
          setSelectedPositionId={(id) => setFilter("selectedPositionId", id)}
          positions={positions}
          loadingPositions={loadingPositions}
          selectedSkillId={selectedSkillId}
          setSelectedSkillId={(id) => setFilter("selectedSkillId", id)}
          skills={skills}
          loadingSkills={loadingSkills}
          isSkillSearching={isSkillSearching}
          handleSkillSearch={handleSkillSearch}
          selectedContentType={selectedContentType}
          setSelectedContentType={(type) => setFilter("selectedContentType", type)}
          onCreateNew={handleCreateNew}
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
          </div>
        )}
      </div>

      {/* Delete Modal only */}
      <QuestionsBankModals
        activeModal={activeModal}
        isSaving={isSaving}
        handleClose={handleCloseModals}
        handleConfirmDelete={handleConfirmDelete}
      />
    </AppPageShell>
  );
}
