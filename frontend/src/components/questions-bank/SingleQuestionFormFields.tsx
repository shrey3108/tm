import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuestionMetricsInput } from "./QuestionMetricsInput";
import { Required } from "@/components/shared/Required";

interface SingleQuestionFormFieldsProps {
  questionText: string;
  onQuestionChange: (value: string) => void;
  marks: number | "";
  onMarksChange: (value: number | "") => void;
  hours: number | "";
  onHoursChange: (value: number | "") => void;
  minutes: number | "";
  onMinutesChange: (value: number | "") => void;
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

export function SingleQuestionFormFields({
  questionText,
  onQuestionChange,
  marks,
  onMarksChange,
  hours,
  onHoursChange,
  minutes,
  onMinutesChange,
  errors,
  onClearError,
}: SingleQuestionFormFieldsProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Question Text */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Question Text <Required /> </Label>
        <Textarea
          value={questionText}
          onChange={(e) => {
            onQuestionChange(e.target.value);
            if (errors.question) {
              onClearError("question");
            }
          }}
          placeholder="Enter the question text..."
          aria-invalid={!!errors.question}
          className="min-h-[100px] text-sm bg-background w-full"
        />
        {errors.question && (
          <p className="text-xs font-medium text-destructive">{errors.question}</p>
        )}
      </div>

      {/* Marks & Duration Section */}
      <QuestionMetricsInput
        marks={marks}
        onMarksChange={onMarksChange}
        hours={hours}
        onHoursChange={onHoursChange}
        minutes={minutes}
        onMinutesChange={onMinutesChange}
        marksError={errors.marks}
        durationError={errors.duration}
        onClearMarksError={() => onClearError("marks")}
        onClearDurationError={() => onClearError("duration")}
      />
    </div>
  );
}
