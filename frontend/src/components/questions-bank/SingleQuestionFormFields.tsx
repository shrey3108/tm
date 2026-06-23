import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SingleQuestionFormFieldsProps {
  questionText: string;
  onQuestionChange: (value: string) => void;
  error?: string;
}

export function SingleQuestionFormFields({
  questionText,
  onQuestionChange,
  error,
}: SingleQuestionFormFieldsProps) {
  return (
    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <Label className="text-sm font-semibold">Question Text</Label>
      <Textarea
        value={questionText}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="Enter the question text..."
        className={cn(
          "min-h-[100px] text-sm bg-background font-medium",
          error && "border-destructive focus-visible:ring-destructive"
        )}
      />
      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}
