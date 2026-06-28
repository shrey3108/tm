import { useCallback } from "react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
import { questionFormSchema, type QuestionFormValues } from "@/schemas/question";
import type { QuestionItem } from "@/types/taskPaper";

interface QuestionModalProps {
  show: boolean;
  handleClose: () => void;
  onSave: (question: QuestionItem) => Promise<void>;
  initialValue?: QuestionItem | string | null;
  isSaving: boolean;
}

const DEFAULT_VALUES: QuestionFormValues = {
  question: "",
  marks: "",
  hours: 0,
  minutes: 5,
};

export default function QuestionModal({
  show,
  handleClose,
  onSave,
  initialValue = null,
  isSaving,
}: QuestionModalProps) {
  const isEditMode = !!initialValue;

  const mapItemToValues = useCallback(
    (val: QuestionItem | string | null): QuestionFormValues => {
      if (!val) {
        return DEFAULT_VALUES;
      }
      if (typeof val === "string") {
        return {
          question: val,
          marks: "",
          hours: 0,
          minutes: 5,
        };
      }
      const duration = val.duration || 0;
      return {
        question: val.question || "",
        marks: val.marks || "",
        hours: Math.floor(duration / 60),
        minutes: duration % 60,
      };
    },
    []
  );

  const onSubmit = async (data: QuestionFormValues) => {
    const hours = typeof data.hours === "number" ? data.hours : 0;
    const minutes = typeof data.minutes === "number" ? data.minutes : 0;
    const duration = hours * 60 + minutes;

    await onSave({
      question: data.question.trim(),
      marks: typeof data.marks === "number" ? data.marks : 0,
      duration,
    });
    handleClose();
  };

  const formModal = useFormModal<QuestionFormValues, QuestionItem | string | null>({
    schema: questionFormSchema,
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
            {/* Question Text */}
            <FormField
              control={control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Question Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the question text ..."
                      rows={3}
                      disabled={isSaving}
                      autoFocus
                      {...field}
                      onFocus={(e) => {
                        const len = e.target.value.length;
                        e.target.setSelectionRange(len, len, "forward");
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                </FormItem>
              )}
            />

            {/* Marks & Duration Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl border border-border bg-muted/20">
              {/* Marks */}
              <FormField
                control={control}
                name="marks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Marks</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10"
                        disabled={isSaving}
                        min={1}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                  </FormItem>
                )}
              />

              {/* Hours */}
              <FormField
                control={control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        disabled={isSaving}
                        min={0}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                  </FormItem>
                )}
              />

              {/* Minutes */}
              <FormField
                control={control}
                name="minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Minutes</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="30"
                        disabled={isSaving}
                        min={0}
                        max={59}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                  </FormItem>
                )}
              />
            </div>

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
