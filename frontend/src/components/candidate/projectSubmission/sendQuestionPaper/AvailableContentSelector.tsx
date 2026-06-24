import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { MCQItem } from "@/types/taskPaper";
import { Search, HelpCircle, ListChecks, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailableContentSelectorProps {
  availableQuestions: string[];
  availableMcqs: MCQItem[];
  availableTasks: string[];
  selectedQuestionIndices: number[];
  selectedMcqIndices: number[];
  selectedTaskIndices: number[];
  onSelectedQuestionIndicesChange: (indices: number[]) => void;
  onSelectedMcqIndicesChange: (indices: number[]) => void;
  onSelectedTaskIndicesChange: (indices: number[]) => void;
}

export function AvailableContentSelector({
  availableQuestions,
  availableMcqs,
  availableTasks,
  selectedQuestionIndices,
  selectedMcqIndices,
  selectedTaskIndices,
  onSelectedQuestionIndicesChange,
  onSelectedMcqIndicesChange,
  onSelectedTaskIndicesChange,
}: AvailableContentSelectorProps) {
  // Search states
  const [qSearch, setQSearch] = useState("");
  const [mcqSearch, setMcqSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");

  // Accordion active open items state
  const [openSections, setOpenSections] = useState<string[]>(["questions"]);

  // Filtered lists with indices preserved
  const filteredQuestions = useMemo(() => {
    return availableQuestions
      .map((text, idx) => ({ text, idx }))
      .filter((q) => q.text.toLowerCase().includes(qSearch.toLowerCase()));
  }, [availableQuestions, qSearch]);

  const filteredMcqs = useMemo(() => {
    return availableMcqs
      .map((item, idx) => ({ item, idx }))
      .filter((mcq) => mcq.item.question.toLowerCase().includes(mcqSearch.toLowerCase()));
  }, [availableMcqs, mcqSearch]);

  const filteredTasks = useMemo(() => {
    return availableTasks
      .map((text, idx) => ({ text, idx }))
      .filter((t) => t.text.toLowerCase().includes(taskSearch.toLowerCase()));
  }, [availableTasks, taskSearch]);

  // Helper: toggle select all for filtered list
  const handleToggleSelectAll = (
    filteredItems: { idx: number }[],
    selectedIndices: number[],
    onChange: (indices: number[]) => void
  ) => {
    const filteredIdxs = filteredItems.map((item) => item.idx);
    const allFilteredSelected = filteredIdxs.every((idx) => selectedIndices.includes(idx));

    if (allFilteredSelected) {
      // Deselect only the filtered items
      onChange(selectedIndices.filter((idx) => !filteredIdxs.includes(idx)));
    } else {
      // Select all filtered items (merge with existing non-filtered selections)
      const newSelection = Array.from(new Set([...selectedIndices, ...filteredIdxs]));
      onChange(newSelection);
    }
  };

  const handleToggleItem = (
    index: number,
    selectedIndices: number[],
    onChange: (indices: number[]) => void
  ) => {
    if (selectedIndices.includes(index)) {
      onChange(selectedIndices.filter((i) => i !== index));
    } else {
      onChange([...selectedIndices, index]);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Accordion

        value={openSections}
        onValueChange={setOpenSections}
        className="w-full border rounded-2xl border-border/40 bg-card/25"
      >
        {/* Questions Section */}
        <AccordionItem value="questions" className="border-b border-border/20">
          <AccordionTrigger className="hover:no-underline py-3 px-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Available Interview Questions</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold">
                {selectedQuestionIndices.length} / {availableQuestions.length} Selected
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3 px-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={qSearch}
                  onChange={(e) => setQSearch(e.target.value)}
                  className="pl-9 h-8 rounded-lg text-xs border-muted-foreground/20 bg-background"
                />
              </div>
              {filteredQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleToggleSelectAll(
                      filteredQuestions,
                      selectedQuestionIndices,
                      onSelectedQuestionIndicesChange
                    )
                  }
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 bg-primary/5 rounded-lg border border-primary/10"
                >
                  {filteredQuestions.every((item) => selectedQuestionIndices.includes(item.idx))
                    ? "Deselect All Matching"
                    : "Select All Matching"}
                </button>
              )}
            </div>

            <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground italic">
                  No questions match your search.
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const isChecked = selectedQuestionIndices.includes(q.idx);
                  return (
                    <div
                      key={q.idx}
                      className={cn(
                        "flex items-start gap-3 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer",
                        isChecked ? "bg-primary/5 border-primary/20" : "hover:bg-muted/20 border-transparent"
                      )}
                      onClick={() =>
                        handleToggleItem(
                          q.idx,
                          selectedQuestionIndices,
                          onSelectedQuestionIndicesChange
                        )
                      }
                    >
                      <Checkbox
                        id={`available-q-${q.idx}`}
                        checked={isChecked}
                        onCheckedChange={() => { }} // toggled on container click
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`available-q-${q.idx}`}
                        className={cn(
                          "text-xs leading-relaxed cursor-pointer flex-1 select-none text-foreground/80",
                          isChecked && "text-foreground font-medium"
                        )}
                        onClick={(e) => e.preventDefault()}
                      >
                        {q.text}
                      </Label>
                    </div>
                  );
                })
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* MCQs Section */}
        <AccordionItem value="mcqs" className="border-b border-border/20">
          <AccordionTrigger className="hover:no-underline py-3 px-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Available MCQs</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold">
                {selectedMcqIndices.length} / {availableMcqs.length} Selected
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3 px-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search MCQs..."
                  value={mcqSearch}
                  onChange={(e) => setMcqSearch(e.target.value)}
                  className="pl-9 h-8 rounded-lg text-xs border-muted-foreground/20 bg-background"
                />
              </div>
              {filteredMcqs.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleToggleSelectAll(
                      filteredMcqs,
                      selectedMcqIndices,
                      onSelectedMcqIndicesChange
                    )
                  }
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 bg-primary/5 rounded-lg border border-primary/10"
                >
                  {filteredMcqs.every((item) => selectedMcqIndices.includes(item.idx))
                    ? "Deselect All Matching"
                    : "Select All Matching"}
                </button>
              )}
            </div>

            <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
              {filteredMcqs.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground italic">
                  No MCQs match your search.
                </div>
              ) : (
                filteredMcqs.map((m) => {
                  const isChecked = selectedMcqIndices.includes(m.idx);
                  return (
                    <div
                      key={m.idx}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer",
                        isChecked ? "bg-primary/5 border-primary/20" : "hover:bg-muted/20 border-transparent"
                      )}
                      onClick={() =>
                        handleToggleItem(
                          m.idx,
                          selectedMcqIndices,
                          onSelectedMcqIndicesChange
                        )
                      }
                    >
                      <Checkbox
                        id={`available-mcq-${m.idx}`}
                        checked={isChecked}
                        onCheckedChange={() => { }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-1 select-none">
                        <Label
                          htmlFor={`available-mcq-${m.idx}`}
                          className={cn(
                            "text-xs leading-relaxed cursor-pointer block text-foreground/80",
                            isChecked && "text-foreground font-medium"
                          )}
                          onClick={(e) => e.preventDefault()}
                        >
                          {m.item.question}
                        </Label>
                        <div className="flex flex-wrap gap-1">
                          {m.item.options.map((opt, optIdx) => (
                            <span
                              key={optIdx}
                              className={cn(
                                "text-sm px-1.5 py-0.5 rounded border scale-95 origin-left",
                                opt === m.item.answer
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold"
                                  : "bg-muted/30 text-muted-foreground border-border/30"
                              )}
                            >
                              {String.fromCharCode(65 + optIdx)}: {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Project Tasks Section */}
        <AccordionItem value="tasks" className="border-none">
          <AccordionTrigger className="hover:no-underline py-3 px-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Available Project Tasks</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-semibold">
                {selectedTaskIndices.length} / {availableTasks.length} Selected
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-3 px-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search project tasks..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-9 h-8 rounded-lg text-xs border-muted-foreground/20 bg-background"
                />
              </div>
              {filteredTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleToggleSelectAll(
                      filteredTasks,
                      selectedTaskIndices,
                      onSelectedTaskIndicesChange
                    )
                  }
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 bg-primary/5 rounded-lg border border-primary/10"
                >
                  {filteredTasks.every((item) => selectedTaskIndices.includes(item.idx))
                    ? "Deselect All Matching"
                    : "Select All Matching"}
                </button>
              )}
            </div>

            <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground italic">
                  No project tasks match your search.
                </div>
              ) : (
                filteredTasks.map((t) => {
                  const isChecked = selectedTaskIndices.includes(t.idx);
                  return (
                    <div
                      key={t.idx}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer",
                        isChecked ? "bg-primary/5 border-primary/20" : "hover:bg-muted/20 border-transparent"
                      )}
                      onClick={() =>
                        handleToggleItem(
                          t.idx,
                          selectedTaskIndices,
                          onSelectedTaskIndicesChange
                        )
                      }
                    >
                      <Checkbox
                        id={`available-task-${t.idx}`}
                        checked={isChecked}
                        onCheckedChange={() => { }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-1 select-none">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-foreground block">
                            Task #{t.idx + 1}
                          </span>
                        </div>
                        <Label
                          htmlFor={`available-task-${t.idx}`}
                          className={cn(
                            "text-xs leading-relaxed cursor-pointer block text-foreground/80 whitespace-pre-wrap",
                            isChecked && "text-foreground font-medium"
                          )}
                          onClick={(e) => e.preventDefault()}
                        >
                          {t.text}
                        </Label>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
