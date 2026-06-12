import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDownloadPaperTaskFile } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import type { QuestionSetPaperRead } from "@/types/taskPaper";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";

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
  const { refetch: downloadFile, loading: isDownloading } = useDownloadPaperTaskFile(
    selectedPredefinedPaper?.task_file_path ? selectedPredefinedPaper?.id : null,
    { enabled: false }
  );

  const handleView = async () => {
    if (!selectedPredefinedPaper?.task_file_path) return;
    try {
      const { data: blob } = await downloadFile();
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        toast.error("Failed to download the task file.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to download the task file.");
    }
  };
  return (
    <div className="space-y-1 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
        <Label className="text-base font-bold text-foreground shrink-0">
          Select Question Set Template
        </Label>
        <Select value={selectedPaperId} onValueChange={(val) => onSelectPaperId(val ?? "")}>
          <SelectTrigger className="w-1/2 bg-gray-200/20 hover:bg-gray-200/50 dark:bg-gray-800/20 dark:hover:bg-gray-800/50  transition-all rounded-xl">
            <SelectValue placeholder="Select template" className="w-full capitalize truncate">
              {
                predefinedPapers.find(
                  (pos) => pos.id === selectedPaperId,
                )?.name
              }
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
        {selectedPredefinedPaper?.task_file_path && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleView}
            disabled={isDownloading}
            className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
            title="View Task File"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Predefined Preview */}
      {selectedPredefinedPaper && (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-2">
          <div>
            <h4 className="text-base font-bold text-foreground mb-1">
              Questions Preview
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
              {selectedPredefinedPaper.questions.map((q, idx) => (
                <li key={idx} className="text-sm text-foreground/80 leading-relaxed">
                  {q}
                </li>
              ))}
            </ol>
          </div>
          {selectedPredefinedPaper.project_task && (
            <div className="pt-1.5 border-t border-border/30">
              <h4 className="text-base font-bold text-foreground mb-1">
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


