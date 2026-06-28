import DeleteModal from "@/components/modal/DeleteModal";

interface QuestionsBankModalsProps {
  activeModal: "delete" | null;
  isSaving: boolean;
  handleClose: () => void;
  handleConfirmDelete: () => Promise<void>;
}

export function QuestionsBankModals({
  activeModal,
  isSaving,
  handleClose,
  handleConfirmDelete,
}: QuestionsBankModalsProps) {
  return (
    <DeleteModal
      show={activeModal === "delete"}
      handleClose={handleClose}
      handleConfirm={handleConfirmDelete}
      title="Delete Item"
      message="Are you sure you want to delete this question? This action will remove it from the predefined question paper template."
      isLoading={isSaving}
    />
  );
}
