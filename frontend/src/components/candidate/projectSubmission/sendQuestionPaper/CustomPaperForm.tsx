import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { QuestionSetPaperRead } from "@/types/taskPaper";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface CustomPaperFormProps {
  predefinedPapers: QuestionSetPaperRead[];
  customQuestions: string[];
  onCustomQuestionsChange: (questions: string[]) => void;
  customProjectTask: string;
  onCustomProjectTaskChange: (value: string) => void;
}

export function CustomPaperForm({
  predefinedPapers,
  customQuestions,
  onCustomQuestionsChange,
  customProjectTask,
  onCustomProjectTaskChange,
}: CustomPaperFormProps) {
  const handleToggleQuestion = (question: string) => {
    if (customQuestions.includes(question)) {
      onCustomQuestionsChange(customQuestions.filter((q) => q !== question));
    } else {
      if (customQuestions.length >= 5) {
        toast.warning("You can only select exactly 5 questions.");
        return;
      }
      onCustomQuestionsChange([...customQuestions, question]);
    }
  };

  const handleToggleSet = (paperQuestions: string[]) => {
    const allSelected = paperQuestions.every((q) => customQuestions.includes(q));
    if (allSelected) {
      onCustomQuestionsChange(customQuestions.filter((q) => !paperQuestions.includes(q)));
    } else {
      const missing = paperQuestions.filter((q) => !customQuestions.includes(q));
      const spaceLeft = 5 - customQuestions.length;
      if (spaceLeft <= 0) {
        toast.warning("You can only select exactly 5 questions.");
        return;
      }
      const toAdd = missing.slice(0, spaceLeft);
      onCustomQuestionsChange([...customQuestions, ...toAdd]);
      if (missing.length > spaceLeft) {
        toast.info(`Selected ${spaceLeft} questions from the set. Maximum of 5 questions reached.`);
      }
    }
  };

  const getSetCheckboxState = (paperQuestions: string[]): { checked: boolean; indeterminate: boolean } => {
    const selectedCountInSet = paperQuestions.filter((q) => customQuestions.includes(q)).length;
    return {
      checked: selectedCountInSet === paperQuestions.length,
      indeterminate: selectedCountInSet > 0 && selectedCountInSet < paperQuestions.length,
    };
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-base font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            Select Exactly 5 Interview Questions
          </label>
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-0.5 rounded-full font-semibold border text-xs flex items-center gap-1 transition-all",
              customQuestions.length === 5
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse"
            )}
          >
            {customQuestions.length === 5 ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {customQuestions.length} / 5 Selected
          </Badge>
        </div>

        {predefinedPapers.length === 0 ? (
          <div className="p-3 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/5 text-center">
            <p className="text-sm text-muted-foreground">
              No existing question sets available to select from.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5  overflow-y-auto pr-1 border border-muted-foreground/10 rounded-xl p-1.5 bg-muted/5 scrollbar-thin">
            {predefinedPapers.map((paper) => {
              const { checked, indeterminate } = getSetCheckboxState(paper.questions);
              return (
                <div key={paper.id} className="border border-border/40 rounded-xl overflow-hidden bg-card/50">
                  {/* Set Header */}
                  <div className="flex items-center gap-1.5 px-1.5 py-1.5 bg-muted/40 border-b border-border/30 hover:bg-muted/60 transition-colors">
                    <Checkbox
                      id={`set-${paper.id}`}
                      checked={checked}
                      indeterminate={indeterminate}
                      onCheckedChange={() => handleToggleSet(paper.questions)}
                    />
                    <Label
                      htmlFor={`set-${paper.id}`}
                    // className="text-sm font-bold text-foreground/90 cursor-pointer flex-1 select-none"
                    >
                      {paper.name}
                    </Label>
                    <span className="text-xs text-muted-foreground font-medium">
                      ({paper.questions.length} questions)
                    </span>
                  </div>

                  {/* Set Questions */}
                  <div className="divide-y divide-border/20">
                    {paper.questions.map((q, qIdx) => {
                      const isChecked = customQuestions.includes(q);
                      const isLimitReached = customQuestions.length >= 5 && !isChecked;
                      return (
                        <div
                          key={qIdx}
                          className={cn(
                            "flex items-start gap-3 px-2 py-1.5 transition-colors",
                            isChecked ? "bg-primary/5" : "hover:bg-muted/20",
                            isLimitReached && "opacity-60"
                          )}
                        >
                          <Checkbox
                            id={`q-${paper.id}-${qIdx}`}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleQuestion(q)}
                            disabled={isLimitReached}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`q-${paper.id}-${qIdx}`}
                            className={cn(
                              "text-xs leading-relaxed cursor-pointer flex-1 select-none text-foreground/80",
                              isChecked && "text-foreground font-medium"
                            )}
                          >
                            {q}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border/20">
        <label className="text-base font-bold text-muted-foreground block mb-2">
          Select Project Task Description
        </label>
        {predefinedPapers.filter((p) => !!p.project_task).length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/5 text-center">
            <p className="text-sm text-muted-foreground">
              No existing project tasks available to select from.
            </p>
          </div>
        ) : (
          <div className=" overflow-y-auto pr-1 border border-muted-foreground/10 rounded-xl p-1.5 bg-muted/5 scrollbar-thin">
            <RadioGroup value={customProjectTask} onValueChange={onCustomProjectTaskChange} >
              {predefinedPapers.map((paper) => {
                if (!paper.project_task) return null;
                const isSelected = customProjectTask === paper.project_task;
                return (
                  <div
                    key={paper.id}
                    className={cn(
                      "flex items-start gap-1.5 p-1.5 rounded-xl border transition-all duration-200 cursor-pointer",
                      isSelected
                        ? "bg-primary/5 border-primary shadow-sm"
                        : "bg-card border-border/40 hover:border-muted-foreground/20"
                    )}
                    onClick={() => onCustomProjectTaskChange(paper.project_task)}
                  >
                    <RadioGroupItem
                      value={paper.project_task}
                      id={`task-${paper.id}`}
                      className="mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label
                      htmlFor={`task-${paper.id}`}
                      className="flex-1 cursor-pointer select-none space-y-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-sm font-bold text-foreground block">{paper.name} Task</span>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {paper.project_task}
                      </p>
                    </label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        )}
      </div>
    </div>
  );
}
