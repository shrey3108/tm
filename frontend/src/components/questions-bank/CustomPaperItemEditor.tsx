import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { QuestionItem, MCQItem, TaskItem } from "@/types/taskPaper";
import { mcqFormSchema } from "@/schemas/taskPaper";
import { questionFormSchema, projectTaskSchema } from "@/schemas/question";
import { SingleQuestionFormFields } from "./SingleQuestionFormFields";
import { MCQFormFields } from "./MCQFormFields";
import { ProjectTaskFormFields } from "./ProjectTaskFormFields";

interface CustomPaperItemEditorProps {
  item: QuestionItem | MCQItem | TaskItem;
  type: "question" | "mcq" | "project_task";
  onSave: (updatedItem: any) => void;
  onCancel: () => void;
}

export function CustomPaperItemEditor({
  item,
  type,
  onSave,
  onCancel,
}: CustomPaperItemEditorProps) {
  // Local states for hours and minutes
  const [hours, setHours] = useState<number | "">("");
  const [minutes, setMinutes] = useState<number | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper to convert MCQ answer text to letter
  const getMCQAnswerLetter = (mcq: MCQItem) => {
    if (!mcq || !mcq.options || !mcq.answer) return "A";
    const idx = mcq.options.indexOf(mcq.answer);
    return idx !== -1 ? String.fromCharCode(65 + idx) : "A";
  };

  // Specific state wrappers
  const [questionState, setQuestionState] = useState<QuestionItem | null>(null);
  const [mcqState, setMCQState] = useState<MCQItem | null>(null);
  const [taskState, setTaskState] = useState<TaskItem | null>(null);

  // Initialize editing states
  useEffect(() => {
    if (type === "question") {
      const q = item as QuestionItem;
      setQuestionState({ ...q });
      setHours(Math.floor((q.duration || 0) / 60) || 0);
      setMinutes((q.duration || 0) % 60 || 0);
    } else if (type === "mcq") {
      const m = item as MCQItem;
      setMCQState({ ...m });
      setHours(Math.floor((m.duration || 0) / 60) || 0);
      setMinutes((m.duration || 0) % 60 || 0);
    } else if (type === "project_task") {
      const t = item as TaskItem;
      setTaskState({ ...t });
      const dur = t.duration || t.total_duration || 0;
      setHours(Math.floor(dur / 60) || 0);
      setMinutes(dur % 60 || 0);
    }
    setErrors({});
  }, [item, type]);

  const handleSave = () => {
    setErrors({});
    if (type === "question" && questionState) {
      const result = questionFormSchema.safeParse({
        question: questionState.question,
        marks: questionState.marks === undefined ? "" : questionState.marks,
        hours: hours === "" ? 0 : Number(hours),
        minutes: minutes === "" ? 0 : Number(minutes),
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          newErrors[issue.path.join(".")] = issue.message;
        });
        setErrors(newErrors);
        return;
      }

      onSave({
        ...questionState,
        question: questionState.question.trim(),
        marks: Number(questionState.marks),
        duration: (Number(hours) || 0) * 60 + (Number(minutes) || 0),
      });
    } else if (type === "mcq" && mcqState) {
      const result = mcqFormSchema.safeParse({
        question: mcqState.question,
        options: mcqState.options,
        answer: getMCQAnswerLetter(mcqState),
        marks: mcqState.marks === undefined ? "" : mcqState.marks,
        hours: hours === "" ? 0 : Number(hours),
        minutes: minutes === "" ? 0 : Number(minutes),
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          if (issue.path[0] === "options" && typeof issue.path[1] === "number") {
            newErrors[`options.${issue.path[1]}`] = issue.message;
          } else {
            newErrors[issue.path.join(".")] = issue.message;
          }
        });
        setErrors(newErrors);
        return;
      }

      onSave({
        ...mcqState,
        question: mcqState.question.trim(),
        options: mcqState.options.map((o) => o.trim()),
        answer: mcqState.answer.trim(),
        marks: Number(mcqState.marks),
        duration: (Number(hours) || 0) * 60 + (Number(minutes) || 0),
      });
    } else if (type === "project_task" && taskState) {
      const result = projectTaskSchema.safeParse({
        project_task: taskState.task || taskState.title || "",
        instructions: taskState.instructions || "",
        hours: hours === "" ? 0 : Number(hours),
        minutes: minutes === "" ? 0 : Number(minutes),
        tasks: taskState.tasks || [],
      });

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          newErrors[issue.path.join(".")] = issue.message;
        });
        setErrors(newErrors);
        return;
      }

      const duration = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
      const total_marks = taskState.tasks?.reduce((sum, t) => sum + (t.marks || 0), 0) || 0;

      onSave({
        ...taskState,
        task: (taskState.task || taskState.title || "").trim(),
        title: (taskState.task || taskState.title || "").trim(),
        description: (taskState.task || taskState.title || "").trim(),
        instructions: (taskState.instructions || "").trim(),
        duration,
        total_duration: duration,
        total_marks,
      });
    }
  };

  return (
    <div className="p-2.5 rounded-lg border border-primary/40  space-y-2 w-full text-xs">
      {type === "question" && questionState && (
        <SingleQuestionFormFields
          questionText={questionState.question}
          onQuestionChange={(val) => setQuestionState((prev) => prev ? { ...prev, question: val } : null)}
          marks={questionState.marks === undefined ? "" : questionState.marks}
          onMarksChange={(val) => setQuestionState((prev) => prev ? { ...prev, marks: val === "" ? undefined : val } : null)}
          hours={hours}
          onHoursChange={setHours}
          minutes={minutes}
          onMinutesChange={setMinutes}
          errors={errors}
          onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: "" }))}
        />
      )}

      {type === "mcq" && mcqState && (
        <MCQFormFields
          mcqQuestion={mcqState.question}
          onMCQQuestionChange={(val) => setMCQState((prev) => prev ? { ...prev, question: val } : null)}
          mcqOptions={mcqState.options || []}
          onMCQOptionsChange={(val) => setMCQState((prev) => prev ? { ...prev, options: val } : null)}
          mcqAnswer={getMCQAnswerLetter(mcqState)}
          onMCQAnswerChange={(val) => setMCQState((prev) => {
            if (!prev) return null;
            const idx = val.charCodeAt(0) - 65;
            return { ...prev, answer: prev.options[idx] || "" };
          })}
          marks={mcqState.marks === undefined ? "" : mcqState.marks}
          onMarksChange={(val) => setMCQState((prev) => prev ? { ...prev, marks: val === "" ? undefined : val } : null)}
          hours={hours}
          onHoursChange={setHours}
          minutes={minutes}
          onMinutesChange={setMinutes}
          errors={errors}
          onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: "" }))}
        />
      )}

      {type === "project_task" && taskState && (
        <ProjectTaskFormFields
          taskDescription={taskState.task || taskState.title || ""}
          onDescriptionChange={(val) => setTaskState((prev) => prev ? { ...prev, task: val, title: val, description: val } : null)}
          taskInstructions={taskState.instructions || ""}
          onInstructionsChange={(val) => setTaskState((prev) => prev ? { ...prev, instructions: val } : null)}
          hours={hours}
          onHoursChange={setHours}
          minutes={minutes}
          onMinutesChange={setMinutes}
          tasks={taskState.tasks || []}
          onTasksChange={(val) => setTaskState((prev) => prev ? { ...prev, tasks: val } : null)}
          errors={errors}
          onClearError={(field) => setErrors((prev) => ({ ...prev, [field]: "" }))}
        />
      )}

      <div className="flex justify-end gap-1.5 pt-1 border-t border-border/40 mt-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs font-semibold"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-7 text-xs font-semibold"
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
