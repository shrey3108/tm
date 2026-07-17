import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
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
  // Helper to convert MCQ answer text to letter
  const getMCQAnswerLetter = (mcq: MCQItem) => {
    if (!mcq || !mcq.options || !mcq.answer) return "A";
    const idx = mcq.options.indexOf(mcq.answer);
    return idx !== -1 ? String.fromCharCode(65 + idx) : "A";
  };

  // Form Hooks
  const questionForm = useForm<any>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      question: "",
      marks: "" as any,
      hours: 0 as any,
      minutes: 0 as any,
    },
  });

  const mcqForm = useForm({
    resolver: zodResolver(mcqFormSchema),
    defaultValues: {
      question: "",
      options: ["", ""],
      answer: "A",
      marks: 0,
      hours: 0,
      minutes: 0,
    },
  });

  const projectTaskForm = useForm<any>({
    resolver: zodResolver(projectTaskSchema),
    defaultValues: {
      project_task: "",
      instructions: "",
      hours: 0,
      minutes: 0,
      tasks: [],
    },
  });

  // Initialize editing states
  useEffect(() => {
    if (type === "question") {
      const q = item as QuestionItem;
      questionForm.reset({
        question: q.question || "",
        marks: q.marks === undefined ? "" : q.marks,
        hours: Math.floor((q.duration || 0) / 60) || 0,
        minutes: (q.duration || 0) % 60 || 0,
      });
    } else if (type === "mcq") {
      const m = item as MCQItem;
      mcqForm.reset({
        question: m.question || "",
        options: m.options || [],
        answer: getMCQAnswerLetter(m),
        marks: m.marks === undefined ? "" : m.marks,
        hours: Math.floor((m.duration || 0) / 60) || 0,
        minutes: (m.duration || 0) % 60 || 0,
      });
    } else if (type === "project_task") {
      const t = item as TaskItem;
      const dur = t.duration || t.total_duration || 0;
      projectTaskForm.reset({
        project_task: t.task || t.title || "",
        instructions: t.instructions || "",
        hours: Math.floor(dur / 60) || 0,
        minutes: dur % 60 || 0,
        tasks: t.tasks || [],
      });
    }
  }, [item, type]);

  const handleSave = async () => {
    if (type === "question") {
      const isValid = await questionForm.trigger();
      if (!isValid) return;
      const values = questionForm.getValues();
      onSave({
        ...item,
        question: values.question.trim(),
        marks: Number(values.marks),
        duration: (Number(values.hours) || 0) * 60 + (Number(values.minutes) || 0),
      });
    } else if (type === "mcq") {
      const isValid = await mcqForm.trigger();
      if (!isValid) return;
      const values = mcqForm.getValues();
      const answerIndex = values.answer.charCodeAt(0) - 65;
      const answerText = (values.options as any[])[answerIndex] || "";
      onSave({
        ...item,
        question: values.question.trim(),
        options: (values.options as any[]).map((o: any) => o.trim()),
        answer: answerText.trim(),
        marks: Number(values.marks),
        duration: (Number(values.hours) || 0) * 60 + (Number(values.minutes) || 0),
      });
    } else if (type === "project_task") {
      const isValid = await projectTaskForm.trigger();
      if (!isValid) return;
      const values = projectTaskForm.getValues();
      const duration = (Number(values.hours) || 0) * 60 + (Number(values.minutes) || 0);
      const total_marks = values.tasks?.reduce((sum: number, t: any) => sum + (t.marks || 0), 0) || 0;
      onSave({
        ...item,
        task: values.project_task.trim(),
        title: values.project_task.trim(),
        description: values.project_task.trim(),
        instructions: values.instructions.trim(),
        duration,
        total_duration: duration,
        tasks: values.tasks,
        total_marks,
      });
    }
  };

  return (
    <div className="p-2.5 rounded-lg border border-primary/40 space-y-2 w-full text-xs">
      {type === "question" && (
        <Form {...questionForm}>
          <SingleQuestionFormFields />
        </Form>
      )}

      {type === "mcq" && (
        <Form {...mcqForm}>
          <MCQFormFields />
        </Form>
      )}

      {type === "project_task" && (
        <Form {...projectTaskForm}>
          <ProjectTaskFormFields />
        </Form>
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
