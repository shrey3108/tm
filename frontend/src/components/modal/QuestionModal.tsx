import { useCallback } from "react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks";
import { questionSchema, type QuestionFormValues } from "@/schemas/admin";

interface QuestionModalProps {
  show: boolean;
  handleClose: () => void;
  onSave: (question: string) => Promise<void>;
  initialValue?: string;
  isSaving: boolean;
}

const DEFAULT_VALUES: QuestionFormValues = {
  question: "",
};

export default function QuestionModal({
  show,
  handleClose,
  onSave,
  initialValue = "",
  isSaving,
}: QuestionModalProps) {
  const isEditMode = !!initialValue;

  const mapItemToValues = useCallback(
    (val: string): QuestionFormValues => ({
      question: val,
    }),
    []
  );

  const onSubmit = async (data: QuestionFormValues) => {
    await onSave(data.question.trim());
    handleClose()
  };

  const formModal = useFormModal<QuestionFormValues, string>({
    schema: questionSchema,
    defaultValues: DEFAULT_VALUES,
    item: initialValue || null,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && !isSaving && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Question" : "Add New Question"}
          </DialogTitle>
        </DialogHeader>

        <Form {...formModal}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Text</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter the question text (minimum 10 characters)..."
                      // rows={4}
                      disabled={isSaving}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                type="button"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                isLoading={isSaving}
              >
                {isEditMode ? "Update Question" : "Add Question"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
