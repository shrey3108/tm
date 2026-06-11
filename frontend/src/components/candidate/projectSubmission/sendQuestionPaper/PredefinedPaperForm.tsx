import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuestionSetPaperRead } from "@/types/taskPaper";

interface PredefinedPaperFormProps {
  predefinedPapers: QuestionSetPaperRead[];
  selectedPaperId: string;
  onSelectPaperId: (id: string) => void;
}

export function PredefinedPaperForm({
  predefinedPapers,
  selectedPaperId,
  onSelectPaperId,
}: PredefinedPaperFormProps) {
  const selectedPredefinedPaper = predefinedPapers?.find((p) => p.id === selectedPaperId);

  return (
    <div className="space-y-2 animate-in fade-in duration-300">
      <div className="space-y-1">
        <label className="text-base font-bold text-foreground">
          Select Question Set Template
        </label>
        <Select value={selectedPaperId} onValueChange={(val) => onSelectPaperId(val ?? "")}>
          <SelectTrigger className="w-full h-11 bg-input/20 border-border/50 hover:bg-input/30 transition-all text-sm rounded-xl">
            <SelectValue placeholder="Select job position" className="w-full capitalize">
              {
                predefinedPapers.find(
                  (pos) => pos.id === selectedPaperId,
                )?.name
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {predefinedPapers?.map((paper) => (
              <SelectItem key={paper.id} value={paper.id} className="cursor-pointer">
                {paper.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Predefined Preview */}
      {selectedPredefinedPaper && (
        <div className="p-1 rounded-xl border border-border/40 bg-muted/20 space-y-2">
          <div>
            <h4 className="text-base font-bold text-foreground ">
              Questions Preview
            </h4>
            <ol className="list-decimal pl-5">
              {selectedPredefinedPaper.questions.map((q, idx) => (
                <li key={idx} className="text-sm text-foreground/80">
                  {q}
                </li>
              ))}
            </ol>
          </div>
          {selectedPredefinedPaper.project_task && (
            <div className="space-y-1 pt-2 border-t border-border/30">
              <h4 className="text-base font-bold text-foreground ">
                Project Task Preview
              </h4>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {selectedPredefinedPaper.project_task}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
