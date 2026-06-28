import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, CheckCircle2, Calendar } from "lucide-react";
import type { EvaluationHistoryRead } from "@/types/candidateStage";
import { cn } from "@/lib/utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";
interface EvaluationHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  history: EvaluationHistoryRead[];
  isLoading: boolean;
  onSelectVersion: (version: EvaluationHistoryRead) => void;
  currentVersionId?: string;
}

export function EvaluationHistoryModal({
  isOpen,
  onOpenChange,
  history,
  isLoading,
  onSelectVersion,
  currentVersionId
}: EvaluationHistoryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[60vw] w-[80vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl">
        <DialogHeader className="p-3 pb-2 bg-linear-to-br from-primary/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <History className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Evaluation History</DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground">
                View previous AI evaluation attempts for this stage.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="h-80">
          <div className="px-3 py-3 space-y-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-8 w-8 border-4 border-primary/20 border-t-primary animate-spin rounded-full" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading History...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <History className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h4 className="text-lg font-bold">No History Found</h4>
                <p className="text-sm text-muted-foreground max-w-[240px]">
                  There are no previous evaluation attempts for this candidate in this stage.
                </p>
              </div>
            ) : (
              history.map((item, index) => {
                const isCurrent = item.id === currentVersionId;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectVersion(item);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "group relative flex items-center gap-4 p-1 rounded-2xl border transition-all cursor-pointer",
                      isCurrent
                        ? "bg-primary/5 border-primary shadow-sm"
                        : "hover:bg-accent/50 hover:border-primary/20 bg-background border-border"
                    )}
                  >
                    {/* Version Badge */}
                    <div className="shrink-0 flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-muted/50 font-black text-lg text-muted-foreground group-hover:text-primary transition-colors">
                      <span className="text-xs uppercase leading-none mb-0.5">Ver</span>
                      {item.version || (history.length - index)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CandidateStatusBadge status={item.result || "N/A"} />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground font-bold">
                          <span>Score: {item.overall_score || 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <DateDisplay date={item.created_at} showTime />
                        </div>
                      </div>
                    </div>

                    {isCurrent && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
