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
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks";
import { projectTaskSchema, type ProjectTaskFormValues } from "@/schemas/admin";

interface ProjectTaskModalProps {
  show: boolean;
  handleClose: () => void;
  onSave: (projectTask: string) => Promise<void>;
  initialValue?: string;
  isSaving: boolean;
}

const DEFAULT_VALUES: ProjectTaskFormValues = {
  project_task: "",
};

export default function ProjectTaskModal({
  show,
  handleClose,
  onSave,
  initialValue = "",
  isSaving,
}: ProjectTaskModalProps) {
  const isEditMode = !!initialValue;

  const mapItemToValues = useCallback(
    (val: string): ProjectTaskFormValues => ({
      project_task: val,
    }),
    []
  );

  const onSubmit = async (data: ProjectTaskFormValues) => {
    await onSave(data.project_task.trim());
    handleClose();
  };

  const formModal = useFormModal<ProjectTaskFormValues, string>({
    schema: projectTaskSchema,
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
            {isEditMode ? "Edit Project Task" : "Add Project Task"}
          </DialogTitle>
        </DialogHeader>

        <Form {...formModal}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="project_task"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Task Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the project task description (minimum 25 characters) ..."
                      disabled={isSaving}
                      rows={6}
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
                {isEditMode ? "Update Task" : "Add Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
