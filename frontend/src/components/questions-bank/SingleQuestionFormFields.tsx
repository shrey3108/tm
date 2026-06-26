import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
        <Label className="text-sm font-semibold">Question Text</Label>
        <Textarea
          value={questionText}
          onChange={(e) => {
            onQuestionChange(e.target.value);
            if (errors.question) {
              onClearError("question");
            }
          }}
          placeholder="Enter the question text..."
          className={cn(
            "min-h-[100px] text-sm bg-background w-full",
            errors.question && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.question && (
          <p className="text-xs font-medium text-destructive">{errors.question}</p>
        )}
      </div>

      {/* Marks & Duration Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl border border-border bg-muted/20">
        {/* Marks */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Marks</Label>
          <Input
            type="number"
            placeholder="e.g. 10"
            min={1}
            value={marks}
            onChange={(e) => {
              const val = e.target.value === "" ? "" : Number(e.target.value);
              onMarksChange(val);
              if (errors.marks) {
                onClearError("marks");
              }
            }}
            className={cn("text-xs h-9 bg-background", errors.marks && "border-destructive")}
          />
          {errors.marks && (
            <p className="text-xs font-semibold text-destructive">{errors.marks}</p>
          )}
        </div>

        {/* Hours */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Duration Hours</Label>
          <Input
            type="number"
            placeholder="0"
            min={0}
            value={hours}
            onChange={(e) => {
              const val = e.target.value === "" ? "" : Number(e.target.value);
              onHoursChange(val);
              if (errors.duration) {
                onClearError("duration");
              }
            }}
            className="text-xs h-9 bg-background"
          />
        </div>

        {/* Minutes */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Duration Minutes</Label>
          <Input
            type="number"
            placeholder="30"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => {
              const val = e.target.value === "" ? "" : Number(e.target.value);
              onMinutesChange(val);
              if (errors.duration) {
                onClearError("duration");
              }
            }}
            className={cn("text-xs h-9 bg-background", errors.duration && "border-destructive")}
          />
          {errors.duration && (
            <p className="text-xs font-semibold text-destructive">{errors.duration}</p>
          )}
        </div>
      </div>
    </div>
  );
}
