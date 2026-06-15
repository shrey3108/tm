import { FileText, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Displays a specialized polling state for AI analysis.
 * Shows an animated spinner and an icon to indicate that a transcript is being processed.
 */
export function PollingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative">
        <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <FileText className="h-8 w-8 text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black uppercase tracking-tight">AI Analysis in Progress</h3>
        <p className="text-muted-foreground max-w-xs mx-auto">
          Your request has been queued and is now being analyzed. Results will be available shortly.
        </p>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  /** Optional error message to display. If not provided, a default "No Evaluation Data" message is shown. */
  error?: string;
  /** Indicates if the empty state is due to a failure in evaluation processing. */
  isFailed?: boolean;
  /** Optional callback to trigger retry evaluation. */
  onRetry?: () => void;
  /** Indicates if retry evaluation is currently in progress. */
  isRetrying?: boolean;
}

/**
 * Displays an empty state when no evaluation data is available for a stage.
 * Can optionally display an error message if the empty state is due to a failure.
 */
export function EmptyState({ error, isFailed, onRetry, isRetrying }: EmptyStateProps) {
  if (isFailed) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-3 gap-3 text-center max-w-md mx-auto my-8 rounded-2xl border border-destructive/20 bg-destructive/5 backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-destructive/10 text-destructive animate-pulse">
          <AlertCircle className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black uppercase tracking-tight text-destructive">
            Evaluation Failed
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
            {error || "An error occurred while evaluating this candidate stage."}
          </p>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            className="relative font-bold px-2 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all duration-200 shadow-md hover:shadow-destructive/20 active:scale-95 flex items-center gap-2 group"
          >
            <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${isRetrying ? "animate-spin" : "group-hover:rotate-180"}`} />
            {isRetrying ? "Retrying Evaluation..." : "Retry Evaluation"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 text-center animate-in fade-in duration-300">
      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-xl font-black uppercase tracking-tight">No Evaluation Data</h3>

      </div>
    </div>
  );
}
