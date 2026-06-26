import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Award, Clock, ListTodo } from "lucide-react";
import { subTaskSchema } from "@/schemas/admin";
import type { SubTaskItem } from "@/types/taskPaper";
import { formatDuration, formatSubTaskDuration } from "@/utils/taskFormatter";

interface SubTasksFormSectionProps {
  tasks: SubTaskItem[];
  onTasksChange: (tasks: SubTaskItem[]) => void;
  error?: string;
  onClearError?: () => void;
  disabled?: boolean;
}

export function SubTasksFormSection({
  tasks = [],
  onTasksChange,
  error,
  onClearError,
  disabled = false,
}: SubTasksFormSectionProps) {
  // Local state for adding a new sub-task
  const [title, setTitle] = useState("");
  const [marks, setMarks] = useState<number | "">("");
  const [hours, setHours] = useState<number | "">("");
  const [minutes, setMinutes] = useState<number | "">("");
  const [subTaskErrors, setSubTaskErrors] = useState<Record<string, string>>({});

  // Compute total marks and duration
  const totalMarks = useMemo(() => tasks.reduce((sum, t) => sum + (t.marks || 0), 0), [tasks]);
  const totalDuration = useMemo(() => tasks.reduce((sum, t) => sum + (t.duration || 0), 0), [tasks]);

  const handleAddSubTask = () => {
    setSubTaskErrors({});

    const parsedHours = hours === "" ? 0 : Number(hours);
    const parsedMinutes = minutes === "" ? 0 : Number(minutes);
    const duration = parsedHours * 60 + parsedMinutes;

    // Validate using Zod subTaskSchema
    const result = subTaskSchema.safeParse({
      title,
      marks: marks === "" ? undefined : Number(marks),
      duration: duration === 0 ? undefined : duration,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!newErrors[path]) {
          newErrors[path] = issue.message;
        }
      });
      setSubTaskErrors(newErrors);
      return;
    }

    // Add sub-task and clear fields
    const updatedTasks = [...tasks, { title: title.trim(), marks: Number(marks), duration }];
    onTasksChange(updatedTasks);

    setTitle("");
    setMarks("");
    setHours("");
    setMinutes("");
    setSubTaskErrors({});

    // Clear main task errors if present
    if (error && onClearError) {
      onClearError();
    }
  };

  const handleRemoveSubTask = (index: number) => {
    const updatedTasks = tasks.filter((_, idx) => idx !== index);
    onTasksChange(updatedTasks);
  };

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-bold flex items-center gap-1.5 w-full">
          <ListTodo className="h-4 w-4 text-primary shrink-0" />
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <span>Project Sub-Tasks</span>
            {tasks.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 flex items-center gap-1.5 font-bold">
                  <Award className="h-3.5 w-3.5" /> Total Marks: {totalMarks}
                </span>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 flex items-center gap-1.5 font-bold">
                  <Clock className="h-3.5 w-3.5" /> Total Duration: {formatDuration(totalDuration)}
                </span>
              </div>
            )}
          </div>
        </Label>
        {error && (
          <span className="text-xs font-semibold text-destructive shrink-0 ml-2">{error}</span>
        )}
      </div>

      {/* Tasks List */}
      {tasks.length > 0 ? (
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {tasks.map((task, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-card/50 hover:bg-muted/10 transition-all duration-200"
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-semibold text-foreground truncate">
                  {index + 1}. {task.title}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1">
                    <Award className="h-3 w-3" /> {task.marks} Marks
                  </span>
                  <span className="h-1 w-1 bg-border rounded-full" />
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatSubTaskDuration(task.duration)}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveSubTask(index)}
                disabled={disabled}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-3 border-2 border-dashed border-border/60 rounded-xl text-muted-foreground text-xs italic">
          No sub-tasks added yet. Define at least one sub-task below.
        </div>
      )}

      {/* Inline Add Task Form */}
      <div className="p-2 rounded-xl border border-border/60 bg-muted/20 space-y-1">
        <div className="text-xs font-bold text-foreground">Add New Sub-Task</div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5">
          {/* Title */}
          <div className="flex flex-col gap-1 md:col-span-6">
            <Label className="text-xs font-semibold">Task Title</Label>
            <Input
              type="text"
              placeholder="e.g. setup db"
              disabled={disabled}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (subTaskErrors.title) {
                  setSubTaskErrors((prev) => ({ ...prev, title: "" }));
                }
              }}
              className={cn("text-xs h-9 bg-background", subTaskErrors.title && "border-destructive")}
            />
            {subTaskErrors.title && (
              <p className="text-xs font-semibold text-destructive">{subTaskErrors.title}</p>
            )}
          </div>

          {/* Marks */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label className="text-xs font-semibold">Marks</Label>
            <Input
              type="number"
              placeholder="20"
              disabled={disabled}
              min={1}
              value={marks}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setMarks(val);
                if (subTaskErrors.marks) {
                  setSubTaskErrors((prev) => ({ ...prev, marks: "" }));
                }
              }}
              className={cn("text-xs h-9 bg-background", subTaskErrors.marks && "border-destructive")}
            />
            {subTaskErrors.marks && (
              <p className="text-xs font-semibold text-destructive">{subTaskErrors.marks}</p>
            )}
          </div>

          {/* Hours */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label className="text-xs font-semibold">Hours</Label>
            <Input
              type="number"
              placeholder="1"
              disabled={disabled}
              min={0}
              value={hours}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setHours(val);
                if (subTaskErrors.duration) {
                  setSubTaskErrors((prev) => ({ ...prev, duration: "" }));
                }
              }}
              className={cn("text-xs h-9 bg-background", subTaskErrors.duration && "border-destructive")}
            />
          </div>

          {/* Minutes */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label className="text-xs font-semibold">Minutes</Label>
            <Input
              type="number"
              placeholder="30"
              disabled={disabled}
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setMinutes(val);
                if (subTaskErrors.duration) {
                  setSubTaskErrors((prev) => ({ ...prev, duration: "" }));
                }
              }}
              className={cn("text-xs h-9 bg-background", subTaskErrors.duration && "border-destructive")}
            />
          </div>
        </div>

        {subTaskErrors.duration && (
          <p className="text-[10px] font-semibold text-destructive">{subTaskErrors.duration}</p>
        )}

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            onClick={handleAddSubTask}
            disabled={disabled}
            variant="outline"
            size="sm"
            className="text-xs font-bold flex items-center gap-1 h-8 rounded-lg bg-background hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add Task
          </Button>
        </div>
      </div>
    </div>
  );
}
