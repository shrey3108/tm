import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Required } from "@/components/shared/Required";
import { useEffect } from "react";
import { toast } from "sonner";
import { QuestionMetricsInput } from "./QuestionMetricsInput";

interface MCQFormFieldsProps {
  mcqQuestion: string;
  onMCQQuestionChange: (value: string) => void;
  mcqOptions: string[];
  onMCQOptionsChange: (options: string[]) => void;
  mcqAnswer: string;
  onMCQAnswerChange: (value: string) => void;
  marks: number | "";
  onMarksChange: (value: number | "") => void;
  hours: number | "";
  onHoursChange: (value: number | "") => void;
  minutes: number | "";
  onMinutesChange: (value: number | "") => void;
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

export function MCQFormFields({
  mcqQuestion,
  onMCQQuestionChange,
  mcqOptions,
  onMCQOptionsChange,
  mcqAnswer,
  onMCQAnswerChange,
  marks,
  onMarksChange,
  hours,
  onHoursChange,
  minutes,
  onMinutesChange,
  errors,
  onClearError,
}: MCQFormFieldsProps) {
  useEffect(() => {
    if (mcqOptions.length >= 26) {
      toast.warning("Maximum 26 options are allowed");
    }
  }, [mcqOptions.length]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* MCQ Question Text */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">MCQ Question Text <Required /></Label>
        <Textarea
          value={mcqQuestion}
          onChange={(e) => {
            onMCQQuestionChange(e.target.value);
            if (errors.question) {
              onClearError("question");
            }
          }}
          placeholder="Enter the MCQ question..."
          aria-invalid={!!errors.question}
          className="min-h-[80px] text-sm bg-background"
        />
        {errors.question && (
          <p className="text-xs font-medium text-destructive">{errors.question}</p>
        )}
      </div>

      {/* MCQ Options */}
      <div className="space-y-1">
        <Label className="text-sm font-semibold">MCQ Options</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mcqOptions.map((opt, idx) => {
            const optionKey = `options.${idx}`;
            const isRequired = idx < 2;
            return (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Option {String.fromCharCode(65 + idx)} {isRequired ? <Required /> : "(Optional)"}
                  </Label>
                  {!isRequired && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextOptions = [...mcqOptions];
                        nextOptions.splice(idx, 1);
                        onMCQOptionsChange(nextOptions);

                        // Adjust answer if the deleted option was selected or affects the index
                        const answerIndex = mcqAnswer.charCodeAt(0) - 65;
                        if (answerIndex === idx) {
                          onMCQAnswerChange("A");
                        } else if (answerIndex > idx) {
                          onMCQAnswerChange(String.fromCharCode(65 + answerIndex - 1));
                        }
                      }}
                      className="text-xs font-semibold text-destructive inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const nextOptions = [...mcqOptions];
                    nextOptions[idx] = e.target.value;
                    onMCQOptionsChange(nextOptions);
                    if (errors[optionKey]) {
                      onClearError(optionKey);
                    }
                  }}
                  placeholder={`Enter option ${String.fromCharCode(65 + idx)}`}
                  aria-invalid={!!errors[optionKey]}
                  className="text-sm"
                />
                {errors[optionKey] && (
                  <p className="text-xs font-medium text-destructive">{errors[optionKey]}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-start pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onMCQOptionsChange([...mcqOptions, ""]);
            }}
            className="text-xs font-semibold flex items-center gap-1.5 bg-background hover:bg-muted"
            disabled={mcqOptions.length >= 26 || mcqOptions.some((opt) => !opt.trim())} // remove second condition if required to add more when options even if previous once are empty
          >
            <Plus className="h-4 w-4" /> Add Option
          </Button>
        </div>
      </div>

      {/* Correct Answer Selector */}
      <div className="flex gap-1.5">
        <div>
          <Label className="text-sm font-semibold">Correct Answer Option</Label>
          <SearchableSelect
            value={mcqAnswer}
            onValueChange={(val) => {
              onMCQAnswerChange(val || "");
              if (errors.answer) {
                onClearError("answer");
              }
            }}
            options={mcqOptions
              .map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                return {
                  id: letter,
                  label: `Option ${letter}${opt.trim() ? `: ${opt}` : ""}`,
                  text: opt,
                };
              })
              .filter((item) => item.text.trim().length > 0)
            }
            placeholder="Select correct option"
            searchPlaceholder="Search option..."
            aria-invalid={!!errors.answer}
            triggerClassName="h-10 text-sm font-semibold rounded-4xl"
          />
          {errors.answer && (
            <p className="text-xs font-medium text-destructive">{errors.answer}</p>
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
    </div>
  );
}
