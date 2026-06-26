import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SubTaskItem } from "@/types/taskPaper";
import { SubTasksFormSection } from "./SubTasksFormSection";

interface ProjectTaskFormFieldsProps {
  taskDescription: string;
  onDescriptionChange: (value: string) => void;
  taskInstructions: string;
  onInstructionsChange: (value: string) => void;
  tasks: SubTaskItem[];
  onTasksChange: (tasks: SubTaskItem[]) => void;
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

export function ProjectTaskFormFields({
  taskDescription,
  onDescriptionChange,
  taskInstructions,
  onInstructionsChange,
  tasks = [],
  onTasksChange,
  errors,
  onClearError,
}: ProjectTaskFormFieldsProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Description Field */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Project Task Description</Label>
        <Textarea
          value={taskDescription}
          onChange={(e) => {
            onDescriptionChange(e.target.value);
            if (errors.project_task) {
              onClearError("project_task");
            }
          }}
          placeholder="Enter the project task description"
          className={cn(
            "min-h-[100px] text-sm bg-background w-full",
            errors.project_task && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.project_task && (
          <p className="text-xs font-medium text-destructive">{errors.project_task}</p>
        )}
      </div>

      {/* Instructions Field */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Instructions</Label>
        <Textarea
          value={taskInstructions}
          onChange={(e) => {
            onInstructionsChange(e.target.value);
            if (errors.instructions) {
              onClearError("instructions");
            }
          }}
          placeholder="Enter detailed instructions for candidates..."
          className={cn(
            "min-h-[80px] text-sm bg-background w-full",
            errors.instructions && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.instructions && (
          <p className="text-xs font-medium text-destructive">{errors.instructions}</p>
        )}
      </div>

      {/* Reusable Sub-tasks Section */}
      <SubTasksFormSection
        tasks={tasks}
        onTasksChange={onTasksChange}
        error={errors.tasks}
        onClearError={() => onClearError("tasks")}
      />
    </div>
  );
}
