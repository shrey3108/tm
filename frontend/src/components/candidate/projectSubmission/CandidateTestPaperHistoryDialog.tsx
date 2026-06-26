// import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { CandidateTestPaperHistoryRead, MCQItem, TaskItem } from "@/types/taskPaper";
import { Calendar } from "lucide-react";

interface CandidateTestPaperHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  history: CandidateTestPaperHistoryRead[];
  candidateName?: string;
}

function formatDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

function getTaskText(task: TaskItem | string): string {
  if (typeof task === "string") return task;
  return task.task || "";
}

function ItemList({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <ol className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5 text-xs text-foreground leading-snug">
            <span className="shrink-0 text-muted-foreground font-mono">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CandidateTestPaperHistoryDialog({
  isOpen,
  onOpenChange,
  history,
  candidateName,
}: CandidateTestPaperHistoryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px] gap-2">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-lg font-semibold">Paper Assignment History</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {candidateName ? `${candidateName} — ` : ""}
            {history.length} paper{history.length !== 1 ? "s" : ""} assigned
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[420px] pr-1">
          <Accordion className="space-y-1.5">
            {history.map((record, index) => {
              const questions = (record.questions ?? []).map((q) => typeof q === "string" ? q : q.question);
              const mcqs = (record.mcqs ?? []).map((m: MCQItem) => m.question);
              const tasks = (record.project_task ?? []).map((t) => getTaskText(t));
              const totalItems = questions.length + mcqs.length + tasks.length;

              return (
                <AccordionItem
                  key={record.id}
                  value={record.id}
                  className="border border-border rounded-xl px-3 py-0 data-[state=open]:bg-muted/40"
                >
                  <AccordionTrigger className="py-2.5 hover:no-underline gap-2 [&>svg]:shrink-0">
                    <div className="flex-1 text-left space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {index === 0 && (
                          <Badge className="text-[10px] px-1.5 py-0 rounded-full h-4">Latest</Badge>
                        )}
                        <span className="text-sm font-medium truncate">{record.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{formatDate(record.assigned_at)}</span>
                        {totalItems > 0 && (
                          <>
                            <span className="mx-1">·</span>
                            <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-0 pb-3 space-y-3">
                    {totalItems === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No questions in this paper.</p>
                    ) : (
                      <>
                        <ItemList items={questions} label="Questions" />
                        <ItemList items={mcqs} label="MCQs" />
                        <ItemList items={tasks} label="Tasks" />
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
