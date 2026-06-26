import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { SubTaskItem } from "@/types/taskPaper";
import { SubTasksFormSection } from "./SubTasksFormSection";
import { Required } from "@/components/shared/Required";

interface ProjectTaskFormFieldsProps {
  taskDescription: string;
  onDescriptionChange: (value: string) => void;
  taskInstructions: string;
  onInstructionsChange: (value: string) => void;
  hours: number | "";
  onHoursChange: (value: number | "") => void;
  minutes: number | "";
  onMinutesChange: (value: number | "") => void;
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
  hours,
  onHoursChange,
  minutes,
  onMinutesChange,
  tasks = [],
  onTasksChange,
  errors,
  onClearError,
}: ProjectTaskFormFieldsProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Description Field */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Project Task Description<Required /></Label>
        <Textarea
          value={taskDescription}
          onChange={(e) => {
            onDescriptionChange(e.target.value);
            if (errors.project_task) {
              onClearError("project_task");
            }
          }}
          placeholder="Enter the project task description"
          aria-invalid={!!errors.project_task}
          className="min-h-[100px] text-sm bg-background w-full"
        />
        {errors.project_task && (
          <p className="text-xs font-medium text-destructive">{errors.project_task}</p>
        )}
      </div>

      {/* Instructions Field */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Instructions<Required /></Label>
        <Textarea
          value={taskInstructions}
          onChange={(e) => {
            onInstructionsChange(e.target.value);
            if (errors.instructions) {
              onClearError("instructions");
            }
          }}
          placeholder="Enter detailed instructions for candidates..."
          aria-invalid={!!errors.instructions}
          className="min-h-[80px] text-sm bg-background w-full"
        />
        {errors.instructions && (
          <p className="text-xs font-medium text-destructive">{errors.instructions}</p>
        )}
      </div>

      {/* Overall Duration Field */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Overall Project Duration<Required /></Label>
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 w-20">
            <Label className="text-xs font-semibold">Hours</Label>
            <Input
              type="number"
              placeholder="0"
              min={0}
              value={hours}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                onHoursChange(val);
                if (errors.minutes) {
                  onClearError("minutes");
                }
              }}
              className="text-xs h-9 bg-background font-medium"
            />
          </div>
          <div className="flex flex-col gap-1 w-20">
            <Label className="text-xs font-semibold">Minutes</Label>
            <Input
              type="number"
              placeholder="30"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                onMinutesChange(val);
                if (errors.minutes) {
                  onClearError("minutes");
                }
              }}
              className="text-xs h-9 bg-background font-medium"
            />
          </div>
        </div>
        {errors.minutes && (
          <p className="text-xs font-semibold text-destructive mt-1">{errors.minutes}</p>
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
