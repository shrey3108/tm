import type { Dispatch } from "react";
import { SingleQuestionFormFields } from "@/components/questions-bank/SingleQuestionFormFields";
import { MCQFormFields } from "@/components/questions-bank/MCQFormFields";
import { ProjectTaskFormFields } from "@/components/questions-bank/ProjectTaskFormFields";
import type {
  QuestionState,
  QuestionAction,
  MCQState,
  MCQAction,
  ProjectTaskState,
  ProjectTaskAction,
} from "@/reducer/questionsBankReducers";
import type { QuestionType } from "@/pages/dashboard/AssignPaperPage";

export interface QuestionContentFormFieldsProps {
  contentType: QuestionType;

  // Normal Question
  questionState: QuestionState;
  questionDispatch: Dispatch<QuestionAction>;

  // MCQ
  mcqState: MCQState;
  mcqDispatch: Dispatch<MCQAction>;

  // Project Task
  taskState: ProjectTaskState;
  taskDispatch: Dispatch<ProjectTaskAction>;

  // Shared
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

export function QuestionContentFormFields({
  contentType,
  questionState,
  questionDispatch,
  mcqState,
  mcqDispatch,
  taskState,
  taskDispatch,
  errors,
  onClearError,
}: QuestionContentFormFieldsProps) {
  if (contentType === "question") {
    return (
      <SingleQuestionFormFields
        questionText={questionState.text}
        onQuestionChange={(v) => questionDispatch({ type: "SET_TEXT", payload: v })}
        marks={questionState.marks}
        onMarksChange={(v) => questionDispatch({ type: "SET_MARKS", payload: v })}
        hours={questionState.hours}
        onHoursChange={(v) => questionDispatch({ type: "SET_HOURS", payload: v })}
        minutes={questionState.minutes}
        onMinutesChange={(v) => questionDispatch({ type: "SET_MINUTES", payload: v })}
        errors={errors}
        onClearError={onClearError}
      />
    );
  }

  if (contentType === "mcq") {
    return (
      <MCQFormFields
        mcqQuestion={mcqState.question}
        onMCQQuestionChange={(v) => mcqDispatch({ type: "SET_QUESTION", payload: v })}
        mcqOptions={mcqState.options}
        onMCQOptionsChange={(v) => mcqDispatch({ type: "SET_OPTIONS", payload: v })}
        mcqAnswer={mcqState.answer}
        onMCQAnswerChange={(v) => mcqDispatch({ type: "SET_ANSWER", payload: v })}
        marks={mcqState.marks}
        onMarksChange={(v) => mcqDispatch({ type: "SET_MARKS", payload: v })}
        hours={mcqState.hours}
        onHoursChange={(v) => mcqDispatch({ type: "SET_HOURS", payload: v })}
        minutes={mcqState.minutes}
        onMinutesChange={(v) => mcqDispatch({ type: "SET_MINUTES", payload: v })}
        errors={errors}
        onClearError={onClearError}
      />
    );
  }

  if (contentType === "project_task") {
    return (
      <ProjectTaskFormFields
        taskDescription={taskState.description}
        onDescriptionChange={(v) => taskDispatch({ type: "SET_DESCRIPTION", payload: v })}
        taskInstructions={taskState.instructions}
        onInstructionsChange={(v) => taskDispatch({ type: "SET_INSTRUCTIONS", payload: v })}
        hours={taskState.hours}
        onHoursChange={(v) => taskDispatch({ type: "SET_HOURS", payload: v })}
        minutes={taskState.minutes}
        onMinutesChange={(v) => taskDispatch({ type: "SET_MINUTES", payload: v })}
        tasks={taskState.tasks}
        onTasksChange={(v) => taskDispatch({ type: "SET_TASKS", payload: v })}
        errors={errors}
        onClearError={onClearError}
      />
    );
  }

  return null;
}
