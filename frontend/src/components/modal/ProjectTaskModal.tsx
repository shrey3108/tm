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
import { useFormModal } from "@/hooks";
import { projectTaskSchema, type ProjectTaskFormValues } from "@/schemas/admin";
import type { TaskItem } from "@/types/taskPaper";
import { SubTasksFormSection } from "../questions-bank/SubTasksFormSection";

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
  hours: 0,
  minutes: 0,
  tasks: [],
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
          hours: 0,
          minutes: 0,
          tasks: [],
        };
      }
      const dur = val.duration ?? val.total_duration ?? 0;
      return {
        project_task: val.task || "",
        instructions: val.instructions || "",
        hours: Math.floor(dur / 60) || 0,
        minutes: dur % 60 || 0,
        tasks: (val.tasks || []).map((t) => ({
          name: t.name || (t as any).title || "",
          description: t.description || "",
          marks: t.marks,
        })),
      };
    },
    []
  );

  const onSubmit = async (data: ProjectTaskFormValues) => {
    const overallDuration = (data.hours || 0) * 60 + (data.minutes || 0);
    await onSave({
      task: data.project_task.trim(),
      instructions: data.instructions.trim(),
      title: data.project_task.trim(),
      description: data.project_task.trim(),
      duration: overallDuration,
      tasks: data.tasks.map((t) => ({
        name: t.name.trim(),
        description: t.description?.trim() || undefined,
        marks: t.marks,
      })),
      total_marks: data.tasks.reduce((sum, t) => sum + (t.marks || 0), 0),
      total_duration: overallDuration,
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

  const { handleFormSubmit, control, watch, setValue, formState: { errors } } = formModal;
  const tasks = watch("tasks") || [];

  return (
    <Dialog open={show} onOpenChange={(open) => !open && !isSaving && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Project Task" : "Add Project Task"}
          </DialogTitle>
        </DialogHeader>

        <Form {...formModal}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Description */}
            <FormField
              control={control}
              name="project_task"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Project Task Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the project task description"
                      disabled={isSaving}
                      rows={3}
                      autoFocus
                      {...field}
                      onFocus={(e) => {
                        const len = e.target.value.length;
                        e.target.setSelectionRange(len, len, "forward");
                      }}
                      className="w-full text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                </FormItem>
              )}
            />

            {/* Instructions */}
            <FormField
              control={control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter detailed instructions for candidates..."
                      disabled={isSaving}
                      rows={3}
                      {...field}
                      className="w-full text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                </FormItem>
              )}
            />

            {/* Overall Project Duration */}
            <div className="flex gap-3 items-end">
              <FormField
                control={control}
                name="hours"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel className="text-sm font-semibold">Duration Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        disabled={isSaving}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Number(e.target.value);
                          field.onChange(val);
                        }}
                        className="text-xs h-9 bg-background font-medium"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="minutes"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel className="text-sm font-semibold">Minutes</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="30"
                        disabled={isSaving}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Number(e.target.value);
                          field.onChange(val);
                        }}
                        className="text-xs h-9 bg-background font-medium"
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                  </FormItem>
                )}
              />
            </div>

            {/* Reusable Sub-tasks Section */}
            <SubTasksFormSection
              tasks={tasks}
              onTasksChange={(updatedTasks) => setValue("tasks", updatedTasks, { shouldValidate: true })}
              error={errors.tasks?.message}
              disabled={isSaving}
            />

            <DialogFooter className="pt-2">
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
