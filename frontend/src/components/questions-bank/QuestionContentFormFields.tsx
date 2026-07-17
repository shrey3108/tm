import { SingleQuestionFormFields } from "@/components/questions-bank/SingleQuestionFormFields";
import { MCQFormFields } from "@/components/questions-bank/MCQFormFields";
import { ProjectTaskFormFields } from "@/components/questions-bank/ProjectTaskFormFields";
import type { QuestionType } from "@/pages/dashboard/AssignPaperPage";

export interface QuestionContentFormFieldsProps {
  contentType: QuestionType;
  disabled?: boolean;
}

export function QuestionContentFormFields({
  contentType,
  disabled = false,
}: QuestionContentFormFieldsProps) {
  if (contentType === "question") {
    return <SingleQuestionFormFields disabled={disabled} />;
  }

  if (contentType === "mcq") {
    return <MCQFormFields disabled={disabled} />;
  }

  if (contentType === "project_task") {
    return <ProjectTaskFormFields disabled={disabled} />;
  }

  return null;
}
