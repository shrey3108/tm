import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface MCQFormFieldsProps {
  mcqQuestion: string;
  onMCQQuestionChange: (value: string) => void;
  mcqOptions: string[];
  onMCQOptionsChange: (options: string[]) => void;
  mcqAnswer: string;
  onMCQAnswerChange: (value: string) => void;
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
  errors,
  onClearError,
}: MCQFormFieldsProps) {
  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">MCQ Question Text</Label>
        <Textarea
          value={mcqQuestion}
          onChange={(e) => {
            onMCQQuestionChange(e.target.value);
            if (errors.question) {
              onClearError("question");
            }
          }}
          placeholder="Enter the MCQ question..."
          className={cn(
            "min-h-[80px] text-sm bg-background font-medium",
            errors.question && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.question && (
          <p className="text-xs font-medium text-destructive">{errors.question}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {mcqOptions.map((opt, idx) => {
          const optionKey = `option${String.fromCharCode(65 + idx)}`; // e.g. optionA, optionB...
          const isOptional = idx >= 2;
          return (
            <div key={idx} className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Option {String.fromCharCode(65 + idx)} {isOptional && "(Optional)"}
              </Label>
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
                placeholder={`Enter option ${String.fromCharCode(65 + idx)}...`}
                className={cn(
                  "text-sm bg-background font-medium",
                  errors[optionKey] && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {errors[optionKey] && (
                <p className="text-xs font-medium text-destructive">{errors[optionKey]}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 max-w-xs">
        <Label className="text-sm font-semibold">Correct Answer Option</Label>
        <Select
          value={mcqAnswer}
          onValueChange={(val) => {
            onMCQAnswerChange(val || "");
            if (errors.answer) {
              onClearError("answer");
            }
          }}
        >
          <SelectTrigger
            className={cn(
              "w-full text-sm font-semibold h-10",
              errors.answer && "border-destructive focus-visible:ring-destructive"
            )}
          >
            <SelectValue placeholder="Select correct option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">Option A</SelectItem>
            <SelectItem value="B">Option B</SelectItem>
            <SelectItem value="C" disabled={!mcqOptions[2]?.trim()}>
              Option C {!mcqOptions[2]?.trim() && "(Disabled - Fill Option C)"}
            </SelectItem>
            <SelectItem value="D" disabled={!mcqOptions[3]?.trim()}>
              Option D {!mcqOptions[3]?.trim() && "(Disabled - Fill Option D)"}
            </SelectItem>
          </SelectContent>
        </Select>
        {errors.answer && (
          <p className="text-xs font-medium text-destructive">{errors.answer}</p>
        )}
      </div>
    </div>
  );
}
