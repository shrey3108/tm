import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Award, ListTodo, Pencil, Check, X } from "lucide-react";
import { subTaskSchema } from "@/schemas/question";
import type { SubTaskItem } from "@/types/taskPaper";
// import { formatDuration, formatSubTaskDuration } from "@/utils/taskFormatter";
// import { QuestionMetricsInput } from "./QuestionMetricsInput";
import { Required } from "@/components/shared/Required";

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
  const [name, setName] = useState("");
  const [marks, setMarks] = useState<number | "">("");
  const [subTaskErrors, setSubTaskErrors] = useState<Record<string, string>>({});

  // Local state for editing an existing sub-task
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMarks, setEditMarks] = useState<number | "">("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Compute total marks
  const totalMarks = useMemo(() => tasks.reduce((sum, t) => sum + (t.marks || 0), 0), [tasks]);

  const handleAddSubTask = () => {
    setSubTaskErrors({});

    // Validate using Zod subTaskSchema
    const result = subTaskSchema.safeParse({
      name,
      marks: marks === "" ? undefined : Number(marks),
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
    const updatedTasks = [
      ...tasks,
      {
        name: name.trim(),
        marks: marks === "" ? undefined : Number(marks),
      },
    ];
    onTasksChange(updatedTasks);

    setName("");
    setMarks("");
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

  const handleStartEdit = (index: number, task: SubTaskItem) => {
    setEditingIndex(index);
    setEditName(task.name);
    setEditMarks(task.marks !== undefined ? task.marks : "");
    setEditErrors({});
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditName("");
    setEditMarks("");
    setEditErrors({});
  };

  const handleSaveEdit = (index: number) => {
    setEditErrors({});

    const result = subTaskSchema.safeParse({
      name: editName,
      marks: editMarks === "" ? undefined : Number(editMarks),
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!newErrors[path]) {
          newErrors[path] = issue.message;
        }
      });
      setEditErrors(newErrors);
      return;
    }

    const updatedTasks = [...tasks];
    updatedTasks[index] = {
      name: editName.trim(),
      marks: editMarks === "" ? undefined : Number(editMarks),
    };
    onTasksChange(updatedTasks);
    handleCancelEdit();
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
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {tasks.map((task, index) => (
            <div
              key={index}
              className="p-3 rounded-xl border border-border/80 bg-card/50 transition-all duration-200"
            >
              {editingIndex === index ? (
                <div className="space-y-2 w-full animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    {/* Edit Name */}
                    <div className="flex flex-col gap-1 md:col-span-8">
                      <Label className="text-xs font-semibold">Task <Required /></Label>
                      <Input
                        type="text"
                        placeholder="e.g. setup db"
                        disabled={disabled}
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          if (editErrors.name) {
                            setEditErrors((prev) => ({ ...prev, name: "" }));
                          }
                        }}
                        aria-invalid={!!editErrors.name}
                        className="text-xs h-8 bg-background"
                      />
                      {editErrors.name && (
                        <p className="text-[10px] font-semibold text-destructive">{editErrors.name}</p>
                      )}
                    </div>

                    {/* Edit Marks */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <Label className="text-xs font-semibold">Marks</Label>
                      <Input
                        type="number"
                        placeholder="10"
                        min={1}
                        disabled={disabled}
                        value={editMarks}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Number(e.target.value);
                          setEditMarks(val);
                          if (editErrors.marks) {
                            setEditErrors((prev) => ({ ...prev, marks: "" }));
                          }
                        }}
                        aria-invalid={!!editErrors.marks}
                        className="text-xs h-8 bg-background font-medium"
                      />
                      {editErrors.marks && (
                        <p className="text-[10px] font-semibold text-destructive">{editErrors.marks}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <Label className="text-xs invisible select-none">Actions</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleSaveEdit(index)}
                          disabled={disabled}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                          disabled={disabled}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {index + 1}. {task.name || (task as any).title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
                      {task.marks !== undefined && (
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" /> {task.marks} Marks
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStartEdit(index, task)}
                      disabled={disabled || editingIndex !== null}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSubTask(index)}
                      disabled={disabled || editingIndex !== null}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
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
          {/* Name */}
          <div className="flex flex-col gap-1 md:col-span-9">
            <Label className="text-xs font-semibold">Task <Required /></Label>
            <Input
              type="text"
              placeholder="e.g. setup db"
              disabled={disabled}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (subTaskErrors.name) {
                  setSubTaskErrors((prev) => ({ ...prev, name: "" }));
                }
              }}
              aria-invalid={!!subTaskErrors.name}
              className="text-xs h-9 bg-background"
            />
            {subTaskErrors.name && (
              <p className="text-xs font-semibold text-destructive">{subTaskErrors.name}</p>
            )}
          </div>

          {/* Marks */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label className="text-xs font-semibold">Marks</Label>
            <Input
              type="number"
              placeholder="10"
              min={1}
              disabled={disabled}
              value={marks}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setMarks(val);
                if (subTaskErrors.marks) {
                  setSubTaskErrors((prev) => ({ ...prev, marks: "" }));
                }
              }}
              aria-invalid={!!subTaskErrors.marks}
              className="text-xs h-9 bg-background "
            />
            {subTaskErrors.marks && (
              <p className="text-xs font-semibold text-destructive">{subTaskErrors.marks}</p>
            )}
          </div>

          {/* Add Button */}
          <div className="flex flex-col gap-1 md:col-span-1">
            <Label className="text-xs invisible select-none">Add</Label>
            <Button
              type="button"
              onClick={handleAddSubTask}
              disabled={disabled}
              variant={"outline"}
              size={"icon"}
              className="h-9 w-9 bg-background hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
