import { FileText } from "lucide-react";

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
}

/**
 * Displays an empty state when no evaluation data is available for a stage.
 * Can optionally display an error message if the empty state is due to a failure.
 */
export function EmptyState({ error }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-xl font-black uppercase tracking-tight">No Evaluation Data</h3>
        <p className="text-muted-foreground max-w-xs mx-auto">
          {error ? error : "Upload a transcript to generate an AI evaluation for this stage."}
        </p>
      </div>
    </div>
  );
}
