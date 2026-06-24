import { Minus, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExtraCountsInputProps {
  extraQuestionCount: number;
  extraMcqCount: number;
  extraTaskCount: number;
  onExtraQuestionCountChange: (count: number) => void;
  onExtraMcqCountChange: (count: number) => void;
  onExtraTaskCountChange: (count: number) => void;
  maxQuestions: number;
  maxMcqs: number;
  maxTasks: number;
  title?: string;
  description?: string;
}

export function ExtraCountsInput({
  extraQuestionCount,
  extraMcqCount,
  extraTaskCount,
  onExtraQuestionCountChange,
  onExtraMcqCountChange,
  onExtraTaskCountChange,
  maxQuestions,
  maxMcqs,
  maxTasks,
  title = "Include Extra Random Additions (Optional)",
  description = "Include additional random elements from the entire content pool. These will be merged and deduplicated.",
}: ExtraCountsInputProps) {
  const handleInputChange = (
    value: string,
    max: number,
    onChange: (val: number) => void
  ) => {
    const val = parseInt(value, 10);
    if (!isNaN(val)) {
      onChange(Math.max(0, Math.min(max, val)));
    } else if (value === "") {
      onChange(0);
    }
  };

  return (
    <div className="border border-border/40 bg-muted/10 p-4 rounded-xl space-y-3 mt-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-primary shrink-0" />
        <h4 className="text-sm font-bold text-foreground">
          {title}
        </h4>
      </div>
      
      <p className="text-xs text-muted-foreground leading-normal">
        {description}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1.5">
        {/* Extra Questions */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="extra-questions-count" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Extra Questions</span>
            <span className="text-[10px] text-muted-foreground/60 font-medium">Max: {maxQuestions}</span>
          </Label>
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-l-lg rounded-r-none border-r-0 hover:bg-muted"
              onClick={() => onExtraQuestionCountChange(Math.max(0, extraQuestionCount - 1))}
              disabled={extraQuestionCount <= 0}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              id="extra-questions-count"
              type="number"
              value={extraQuestionCount}
              onChange={(e) => handleInputChange(e.target.value, maxQuestions, onExtraQuestionCountChange)}
              className="h-8 w-12 rounded-none text-center font-semibold text-xs focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min={0}
              max={maxQuestions}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-r-lg rounded-l-none border-l-0 hover:bg-muted"
              onClick={() => onExtraQuestionCountChange(Math.min(maxQuestions, extraQuestionCount + 1))}
              disabled={extraQuestionCount >= maxQuestions}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Extra MCQs */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="extra-mcqs-count" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Extra MCQs</span>
            <span className="text-[10px] text-muted-foreground/60 font-medium">Max: {maxMcqs}</span>
          </Label>
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-l-lg rounded-r-none border-r-0 hover:bg-muted"
              onClick={() => onExtraMcqCountChange(Math.max(0, extraMcqCount - 1))}
              disabled={extraMcqCount <= 0}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              id="extra-mcqs-count"
              type="number"
              value={extraMcqCount}
              onChange={(e) => handleInputChange(e.target.value, maxMcqs, onExtraMcqCountChange)}
              className="h-8 w-12 rounded-none text-center font-semibold text-xs focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min={0}
              max={maxMcqs}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-r-lg rounded-l-none border-l-0 hover:bg-muted"
              onClick={() => onExtraMcqCountChange(Math.min(maxMcqs, extraMcqCount + 1))}
              disabled={extraMcqCount >= maxMcqs}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Extra Tasks */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="extra-tasks-count" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Extra Tasks</span>
            <span className="text-[10px] text-muted-foreground/60 font-medium">Max: {maxTasks}</span>
          </Label>
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-l-lg rounded-r-none border-r-0 hover:bg-muted"
              onClick={() => onExtraTaskCountChange(Math.max(0, extraTaskCount - 1))}
              disabled={extraTaskCount <= 0}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              id="extra-tasks-count"
              type="number"
              value={extraTaskCount}
              onChange={(e) => handleInputChange(e.target.value, maxTasks, onExtraTaskCountChange)}
              className="h-8 w-12 rounded-none text-center font-semibold text-xs focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min={0}
              max={maxTasks}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-r-lg rounded-l-none border-l-0 hover:bg-muted"
              onClick={() => onExtraTaskCountChange(Math.min(maxTasks, extraTaskCount + 1))}
              disabled={extraTaskCount >= maxTasks}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
