import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuestionSetPaperRead } from "@/types/taskPaper";
import { FileText, HelpCircle, CheckSquare } from "lucide-react";

interface SelectPaperFormProps {
  predefinedPapers: QuestionSetPaperRead[];
  selectedPaperId: string;
  onSelectPaperId: (id: string) => void;
}

export function SelectPaperForm({
  predefinedPapers,
  selectedPaperId,
  onSelectPaperId,
}: SelectPaperFormProps) {
  const selectedPaper = predefinedPapers?.find((p) => p.id === selectedPaperId);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <Label htmlFor="paper-select" className="text-sm font-bold text-foreground">
          Select Question Set Template
        </Label>
        <Select value={selectedPaperId} onValueChange={(val) => onSelectPaperId(val ?? "")}>
          <SelectTrigger id="paper-select" className="w-full bg-muted/20 hover:bg-muted/40 transition-all rounded-xl border-border/60">
            <SelectValue placeholder="Select a template" className="w-full capitalize truncate">
              {selectedPaper?.name || "Select a template"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {predefinedPapers?.map((paper) => (
              <SelectItem key={paper.id} value={paper.id} className="cursor-pointer capitalize">
                {paper.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPaper ? (
        <div className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
              <FileText className="h-3.5 w-3.5" />
              <span>{selectedPaper.questions?.length || 0} Questions</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-lg">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>{selectedPaper.mcqs?.length || 0} MCQs</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{selectedPaper.project_task?.length || 0} Tasks</span>
            </div>
          </div>



          {/* Expanded Preview (Detailed overview of questions) */}
          <div className="space-y-3 pt-3 border-t border-border/20">
            {selectedPaper.questions && selectedPaper.questions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Questions
                </h4>
                <ul className="list-decimal pl-4.5 space-y-1">
                  {selectedPaper.questions.map((q, idx) => (
                    <li key={idx} className="text-xs text-foreground/80 leading-relaxed">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPaper.project_task && selectedPaper.project_task.length > 0 && (
              <div className="pt-2 border-t border-border/10">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Project Tasks
                </h4>
                <ul className="list-decimal pl-4.5 space-y-1">
                  {selectedPaper.project_task.map((task, idx) => (
                    <li key={idx} className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {typeof task === "string" ? task : task?.task || ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-border/60 rounded-xl bg-card/10 text-muted-foreground text-xs">
          Please select a template to preview its contents.
        </div>
      )}
    </div>
  );
}
