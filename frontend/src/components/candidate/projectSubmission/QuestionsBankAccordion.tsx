import { useState } from "react";
import { toast } from "sonner";
import { Edit2, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { QuestionModal, DeleteModal, ProjectTaskModal } from "@/components/modal";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  useAddQuestionToPaperMutation,
  useUpdateQuestionInPaperMutation,
  useDeleteQuestionFromPaperMutation,
  useAddProjectTaskToPaperMutation,
  useUpdateProjectTaskInPaperMutation,
  useDeleteProjectTaskFromPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import type { QuestionSetPaperRead, TaskItem } from "@/types/taskPaper";
import { extractErrorMessage } from "@/utils/error";

interface QuestionsBankAccordionProps {
  questionPapers: QuestionSetPaperRead[];
  refetchPapers: () => void;
}

export function QuestionsBankAccordion({
  questionPapers,
  refetchPapers,
}: QuestionsBankAccordionProps) {
  // Mutations
  const addQuestionMutation = useAddQuestionToPaperMutation();
  const updateQuestionMutation = useUpdateQuestionInPaperMutation();
  const deleteQuestionMutation = useDeleteQuestionFromPaperMutation();

  const addProjectTaskMutation = useAddProjectTaskToPaperMutation();
  const updateProjectTaskMutation = useUpdateProjectTaskInPaperMutation();
  const deleteProjectTaskMutation = useDeleteProjectTaskFromPaperMutation();

  // Modal states for Question
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionModalMode, setQuestionModalMode] = useState<"add" | "edit">("add");
  const [selectedQuestionPaperId, setSelectedQuestionPaperId] = useState<string | null>(null);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [selectedQuestionText, setSelectedQuestionText] = useState("");

  // Modal states for Project Task
  const [isProjectTaskModalOpen, setIsProjectTaskModalOpen] = useState(false);
  const [projectTaskModalMode, setProjectTaskModalMode] = useState<"add" | "edit">("add");
  const [selectedProjectTaskPaperId, setSelectedProjectTaskPaperId] = useState<string | null>(null);
  const [selectedProjectTaskIndex, setSelectedProjectTaskIndex] = useState<number | null>(null);
  const [selectedProjectTaskText, setSelectedProjectTaskText] = useState("");

  // Delete Confirmation Modal states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"question" | "task" | null>(null);
  const [paperIdToDelete, setPaperIdToDelete] = useState<string | null>(null);
  const [indexToDelete, setIndexToDelete] = useState<number | null>(null);

  // Accordion active open items state (default open none)
  // const [openItems, setOpenItems] = useState<string[]>(["questions", "tasks"]);
  const [openItems, setOpenItems] = useState<string[]>([]);

  // Flatten logic
  const allQuestions = (questionPapers || []).flatMap((paper) =>
    (paper.questions || []).map((q, idx) => ({
      text: q,
      index: idx,
      paperId: paper.id,
      paperName: paper.name,
    }))
  );

  const allProjectTasks = (questionPapers || []).flatMap((paper) =>
    (paper.project_task || []).map((task, idx) => ({
      text: typeof task === "string" ? task : task?.task || "",
      index: idx,
      paperId: paper.id,
      paperName: paper.name,
    }))
  );

  // CRUD Handlers for Questions
  const handleOpenAddQuestionModal = () => {
    if (!questionPapers || questionPapers.length === 0) {
      toast.error("Please upload a question set paper template first.");
      return;
    }
    setQuestionModalMode("add");
    setSelectedQuestionPaperId(questionPapers[0].id); // Always add to the first paper available // require paper id !! 
    setSelectedQuestionIndex(null);
    setSelectedQuestionText("");
    setIsQuestionModalOpen(true);
  };

  const handleOpenEditQuestionModal = (paperId: string, index: number, text: string) => {
    setQuestionModalMode("edit");
    setSelectedQuestionPaperId(paperId);
    setSelectedQuestionIndex(index);
    setSelectedQuestionText(text);
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (text: string) => {
    const paperId = selectedQuestionPaperId;
    if (!paperId) return;

    if (questionModalMode === "add") {
      await addQuestionMutation.mutateAsync(
        { paperId, question: text },
        {
          onSuccess: () => {
            toast.success("Question added successfully!");
            refetchPapers();
          },
          onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, "Failed to add question."));
          },
        }
      );
    } else if (questionModalMode === "edit" && selectedQuestionIndex !== null) {
      await updateQuestionMutation.mutateAsync(
        { paperId, index: selectedQuestionIndex, question: text },
        {
          onSuccess: () => {
            toast.success("Question updated successfully!");
            refetchPapers();
          },
          onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, "Failed to update question."));
          },
        }
      );
    }
  };

  const handleOpenDeleteQuestionConfirm = (paperId: string, index: number) => {
    setDeleteType("question");
    setPaperIdToDelete(paperId);
    setIndexToDelete(index);
    setIsDeleteConfirmOpen(true);
  };

  // CRUD Handlers for Project Tasks
  const handleOpenAddProjectTaskModal = () => {
    if (!questionPapers || questionPapers.length === 0) {
      toast.error("Please upload a question set paper template first.");
      return;
    }
    setProjectTaskModalMode("add");
    setSelectedProjectTaskPaperId(questionPapers[0].id); // Always add to the first paper available
    setSelectedProjectTaskIndex(null);
    setSelectedProjectTaskText("");
    setIsProjectTaskModalOpen(true);
  };

  const handleOpenEditProjectTaskModal = (paperId: string, index: number, text: string) => {
    setProjectTaskModalMode("edit");
    setSelectedProjectTaskPaperId(paperId);
    setSelectedProjectTaskIndex(index);
    setSelectedProjectTaskText(text);
    setIsProjectTaskModalOpen(true);
  };

  const handleSaveProjectTask = async (text: TaskItem | string) => {
    const paperId = selectedProjectTaskPaperId;
    if (!paperId) return;

    if (projectTaskModalMode === "add") {
      await addProjectTaskMutation.mutateAsync(
        { paperId, projectTask: text },
        {
          onSuccess: () => {
            toast.success("Project task added successfully!");
            refetchPapers();
          },
          onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, "Failed to add project task."));
          },
        }
      );
    } else if (projectTaskModalMode === "edit" && selectedProjectTaskIndex !== null) {
      await updateProjectTaskMutation.mutateAsync(
        { paperId, index: selectedProjectTaskIndex, projectTask: text },
        {
          onSuccess: () => {
            toast.success("Project task updated successfully!");
            refetchPapers();
          },
          onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, "Failed to update project task."));
          },
        }
      );
    }
  };

  const handleOpenDeleteProjectTaskConfirm = (paperId: string, index: number) => {
    setDeleteType("task");
    setPaperIdToDelete(paperId);
    setIndexToDelete(index);
    setIsDeleteConfirmOpen(true);
  };

  // Confirm delete for both type
  const handleConfirmDelete = async () => {
    if (paperIdToDelete === null || indexToDelete === null || !deleteType) return;

    if (deleteType === "question") {
      await deleteQuestionMutation.mutateAsync(
        { paperId: paperIdToDelete, index: indexToDelete },
        {
          onSuccess: () => {
            toast.success("Question deleted successfully!");
            setIsDeleteConfirmOpen(false);
            setPaperIdToDelete(null);
            setIndexToDelete(null);
            setDeleteType(null);
            refetchPapers();
          },
          onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, "Failed to delete question."));
          },
        }
      );
    } else if (deleteType === "task") {
      await deleteProjectTaskMutation.mutateAsync(
        { paperId: paperIdToDelete, index: indexToDelete },
        {
          onSuccess: () => {
            toast.success("Project task deleted successfully!");
            setIsDeleteConfirmOpen(false);
            setPaperIdToDelete(null);
            setIndexToDelete(null);
            setDeleteType(null);
            refetchPapers();
          },
          onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, "Failed to delete project task."));
          },
        }
      );
    }
  };

  return (
    <div className="space-y-2">
      <Accordion
        value={openItems}
        onValueChange={setOpenItems}
        className="w-full border rounded-2xl border-border/40 bg-card/25"
      >
        {/* Questions Accordion Item */}
        <AccordionItem value="questions" className="border-b border-border/20">
          <AccordionTrigger className="hover:no-underline py-2 px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Questions</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold">
                {allQuestions.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3 px-4">
            <div className="space-y-2">
              <div className="space-y-2  pr-1">
                {allQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground italic text-xs">
                    No questions available.
                  </div>
                ) : (
                  <ul className="pl-6 list-decimal space-y-1.5 pt-1">
                    {allQuestions.map((q, idx) => (
                      <li
                        key={`${q.paperId}-${q.index}-${idx}`}
                        className="group/item relative p-1 pr-20 hover:bg-muted/30 rounded-lg transition-colors duration-200"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-relaxed wrap-break-word whitespace-pre-wrap">
                            {q.text}
                          </p>
                          {/* {questionPapers.length > 1 && (
                            <span className="inline-block text-[10px] text-muted-foreground/75 bg-muted/40 px-1.5 py-0.5 rounded-md font-semibold">
                              {q.paperName}
                            </span>
                          )} */}
                        </div>

                        <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 ">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditQuestionModal(q.paperId, q.index, q.text)}
                              className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDeleteQuestionConfirm(q.paperId, q.index)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </PermissionGuard>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-start pt-1">
                <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                  <Button
                    onClick={handleOpenAddQuestionModal}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold border-dashed border-primary/20 hover:border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-all"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Question
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Project Tasks Accordion Item */}
        <AccordionItem value="tasks" className="border-none">
          <AccordionTrigger className="hover:no-underline py-2 px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Project Tasks</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold">
                {allProjectTasks.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3 px-4">
            <div className="space-y-2">


              <div className="space-y-2 pr-1">
                {allProjectTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground italic text-xs">
                    No project tasks available.
                  </div>
                ) : (
                  <ul className="pl-6 list-decimal space-y-1.5 pt-1">
                    {allProjectTasks.map((t, idx) => (
                      <li
                        key={`${t.paperId}-${t.index}-${idx}`}
                        className="group/item relative pl-1 pr-20 hover:bg-muted/30 rounded-lg transition-colors duration-200"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-relaxed wrap-break-word whitespace-pre-wrap">
                            {t.text}
                          </p>
                          {/* {questionPapers.length > 1 && (
                            <span className="inline-block text-[10px] text-muted-foreground/75 bg-muted/40 px-1.5 py-0.5 rounded-md font-semibold">
                              {t.paperName}
                            </span>
                          )} */}
                        </div>

                        <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 ">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditProjectTaskModal(t.paperId, t.index, t.text)}
                              className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDeleteProjectTaskConfirm(t.paperId, t.index)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </PermissionGuard>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-start pt-1">
                <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                  <Button
                    onClick={handleOpenAddProjectTaskModal}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold border-dashed border-primary/20 hover:border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-all"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Project Task
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* CRUD Modals */}
      <QuestionModal
        show={isQuestionModalOpen}
        handleClose={() => setIsQuestionModalOpen(false)}
        onSave={handleSaveQuestion}
        initialValue={selectedQuestionText}
        isSaving={addQuestionMutation.isPending || updateQuestionMutation.isPending}
      />

      <ProjectTaskModal
        show={isProjectTaskModalOpen}
        handleClose={() => setIsProjectTaskModalOpen(false)}
        onSave={handleSaveProjectTask}
        initialValue={selectedProjectTaskText}
        isSaving={addProjectTaskMutation.isPending || updateProjectTaskMutation.isPending}
      />

      <DeleteModal
        show={isDeleteConfirmOpen}
        handleClose={() => setIsDeleteConfirmOpen(false)}
        handleConfirm={handleConfirmDelete}
        title={deleteType === "question" ? "Delete Question" : "Delete Project Task"}
        message={
          deleteType === "question"
            ? "Are you sure you want to delete this question? This action cannot be undone."
            : "Are you sure you want to delete this project task? This action cannot be undone."
        }
        isLoading={deleteQuestionMutation.isPending || deleteProjectTaskMutation.isPending}
      />
    </div>
  );
}
