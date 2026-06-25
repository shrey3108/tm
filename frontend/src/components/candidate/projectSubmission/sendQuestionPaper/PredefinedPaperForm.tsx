import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDownloadPaperTaskFile } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import type { QuestionSetPaperRead } from "@/types/taskPaper";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExternalLink, Loader2, Award, Clock } from "lucide-react";
import { formatDuration } from "@/utils/taskFormatter";

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
      <div className="flex sm:flex-row sm:items-center gap-1">
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
        <div className="rounded-xl border border-border/40 bg-muted/20">
          <div>
            <h4 className="text-base font-bold text-foreground mb-1">
              Questions Preview
            </h4>
            <ol className="list-decimal pl-5 space-y-1.5">
              {selectedPredefinedPaper.questions.map((q, idx) => {
                const qText = typeof q === "string" ? q : q.question || "";
                const qMarks = typeof q === "string" ? undefined : q.marks;
                const qDuration = typeof q === "string" ? undefined : q.duration;
                return (
                  <li key={idx} className="text-sm text-foreground/80 leading-relaxed">
                    <span className="font-medium">{qText}</span>
                    {(qMarks !== undefined || (qDuration !== undefined && qDuration > 0)) && (
                      <span className="inline-flex flex-wrap items-center gap-1.5 ml-2 text-[10px] select-none">
                        {qMarks !== undefined && (
                          <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full font-bold">
                            <Award className="h-2.5 w-2.5" /> {qMarks} Marks
                          </span>
                        )}
                        {qDuration !== undefined && qDuration > 0 && (
                          <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-full font-bold">
                            <Clock className="h-2.5 w-2.5" /> {formatDuration(qDuration)}
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          {selectedPredefinedPaper.project_task && selectedPredefinedPaper.project_task.length > 0 && (
            <div className="pt-1.5 border-t border-border/30">
              <h4 className="text-base font-bold text-foreground mb-1">
                Project Tasks Preview
              </h4>
              <ol className="list-decimal pl-5 space-y-1">
                {selectedPredefinedPaper.project_task.map((task, idx) => (
                  <li key={idx} className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {typeof task === "string" ? task : task?.task || ""}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


