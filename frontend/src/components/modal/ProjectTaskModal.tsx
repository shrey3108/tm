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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks";
import { projectTaskSchema, type ProjectTaskFormValues } from "@/schemas/admin";
import type { TaskItem } from "@/types/taskPaper";

interface ProjectTaskModalProps {
  show: boolean;
  handleClose: () => void;
  onSave: (projectTask: TaskItem) => Promise<void>;
  initialValue?: TaskItem | string | null;
  isSaving: boolean;
}

const DEFAULT_VALUES: ProjectTaskFormValues = {
  project_task: "",
  instructions: "",
  prerequisites: "",
};

export default function ProjectTaskModal({
  show,
  handleClose,
  onSave,
  initialValue = null,
  isSaving,
}: ProjectTaskModalProps) {
  const isEditMode = !!initialValue;

  const mapItemToValues = useCallback(
    (val: TaskItem | string | null): ProjectTaskFormValues => {
      if (!val) {
        return DEFAULT_VALUES;
      }
      if (typeof val === "string") {
        return {
          project_task: val,
          instructions: "",
          prerequisites: "",
        };
      }
      return {
        project_task: val.task || "",
        instructions: val.instructions || "",
        prerequisites: Array.isArray(val.prerequisites) ? val.prerequisites.join("\n") : "",
      };
    },
    []
  );

  const onSubmit = async (data: ProjectTaskFormValues) => {
    const prerequisitesArray = data.prerequisites
      ? data.prerequisites.split("\n").map((p) => p.trim()).filter(Boolean)
      : [];

    await onSave({
      task: data.project_task.trim(),
      instructions: data.instructions.trim(),
      prerequisites: prerequisitesArray,
    });
    handleClose();
  };

  const formModal = useFormModal<ProjectTaskFormValues, TaskItem | string | null>({
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
                      rows={4}
                      autoFocus
                      {...field}
                      onFocus={(e) => {
                        const len = e.target.value.length;
                        e.target.setSelectionRange(len, len, "forward");
                      }}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter detailed instructions for candidates..."
                      disabled={isSaving}
                      rows={3}
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="prerequisites"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prerequisites</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Node.js >= 18&#10;Basic knowledge of React..."
                      disabled={isSaving}
                      rows={3}
                      {...field}
                      className="w-full"
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
