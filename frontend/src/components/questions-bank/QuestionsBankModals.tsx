import {
  QuestionModal,
  ProjectTaskModal,
  MCQModal,
  DeleteModal,
} from "@/components/modal";
import type { MCQItem, TaskItem } from "@/types/taskPaper";
import type { FlatItem } from "./QuestionsBankColumns";

interface QuestionsBankModalsProps {
  activeModal: "question" | "mcq" | "task" | "delete" | null;
  modalMode: "add" | "edit";
  selectedItem: FlatItem | null;
  isSaving: boolean;
  handleClose: () => void;
  handleSaveQuestion: (content: string) => Promise<void>;
  handleSaveProjectTask: (content: TaskItem) => Promise<void>;
  handleSaveMCQ: (mcq: MCQItem) => Promise<void>;
  handleConfirmDelete: () => Promise<void>;
}

export function QuestionsBankModals({
  activeModal,
  modalMode,
  selectedItem,
  isSaving,
  handleClose,
  handleSaveQuestion,
  handleSaveProjectTask,
  handleSaveMCQ,
  handleConfirmDelete,
}: QuestionsBankModalsProps) {
  return (
    <>
      <QuestionModal
        show={activeModal === "question"}
        handleClose={handleClose}
        onSave={handleSaveQuestion}
        initialValue={modalMode === "edit" ? selectedItem?.content : ""}
        isSaving={isSaving}
      />

      <ProjectTaskModal
        show={activeModal === "task"}
        handleClose={handleClose}
        onSave={handleSaveProjectTask}
        initialValue={modalMode === "edit" ? selectedItem?.rawData : null}
        isSaving={isSaving}
      />

      <MCQModal
        show={activeModal === "mcq"}
        handleClose={handleClose}
        onSave={handleSaveMCQ}
        initialValue={modalMode === "edit" ? selectedItem?.rawData : null}
        isSaving={isSaving}
      />

      <DeleteModal
        show={activeModal === "delete"}
        handleClose={handleClose}
        handleConfirm={handleConfirmDelete}
        title="Delete Item"
        message="Are you sure you want to delete this question? This action will remove it from the predefined question paper template."
        isLoading={isSaving}
      />
    </>
  );
}
