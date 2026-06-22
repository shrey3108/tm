import { HelpCircle, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RandomizedPaperViewProps {
  jobTitle?: string;
  positionName?: string;
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  maxQuestions?: number;
}

export function RandomizedPaperView({
  jobTitle,
  positionName,
  questionCount,
  onQuestionCountChange,
  maxQuestions,
}: RandomizedPaperViewProps) {
  const handleDecrement = () => {
    onQuestionCountChange(Math.max(1, questionCount - 1));
  };

  const handleIncrement = () => {
    onQuestionCountChange(Math.min(maxQuestions || 999, questionCount + 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      onQuestionCountChange(Math.max(1, Math.min(maxQuestions || 999, val)));
    }
  };

  return (
    <div className="border border-border/40 bg-muted/20 p-4 rounded-xl space-y-4 animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-foreground">
            Randomized Generation Mode
          </h4>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            This will automatically select{" "}
            <span className="font-semibold text-foreground">
              {questionCount} {questionCount === 1 ? "unique question" : "unique questions"}
            </span>{" "}
            at random from all available templates uploaded for the{" "}
            <span className="font-semibold text-foreground capitalize">
              {jobTitle || "Job Title"}
            </span>{" "}
            job role (experience level:{" "}
            <span className="font-semibold text-foreground capitalize">
              {positionName || "Position Level"}
            </span>
            ), and select an associated project task.
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-border/20 flex flex-col gap-2">
        <Label htmlFor="random-question-count" className="text-sm font-semibold text-foreground">
          Choose Number of Questions:
        </Label>
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-l-xl rounded-r-none border-r-0 hover:bg-muted"
              onClick={handleDecrement}
              disabled={questionCount <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              id="random-question-count"
              type="number"
              value={questionCount}
              onChange={handleInputChange}
              className="h-9 w-16 rounded-none text-center font-semibold text-sm focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min={1}
              max={maxQuestions}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-r-xl rounded-l-none border-l-0 hover:bg-muted"
              onClick={handleIncrement}
              disabled={maxQuestions ? questionCount >= maxQuestions : false}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {maxQuestions !== undefined && (
            <span className="text-xs text-muted-foreground font-medium">
              (Maximum available: {maxQuestions})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
