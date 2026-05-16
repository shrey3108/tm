import { HrDecision } from "@/components/modal/candidate-details/HrDecision";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { FileText, History } from "lucide-react";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import type { Transcript } from "@/types/transcript";
import { Button } from "@/components/ui/button";

interface CandidateHistoryGridProps {
  /** Array of HR decisions to display */
  hrDecisionHistory: HrDecisionHistoryItem[];
  /** Array of related transcripts to display */
  transcriptHistory: Transcript[];
  /** Callback when a transcript card is clicked */
  onTranscriptClick: (transcriptId: string) => void;
}

/**
 * A layout component that displays the candidate's decision history and 
 * interview transcripts side-by-side in a responsive grid.
 */
export function CandidateHistoryGrid({
  hrDecisionHistory,
  transcriptHistory,
  onTranscriptClick,
}: CandidateHistoryGridProps) {
  if (hrDecisionHistory.length === 0 && transcriptHistory.length === 0) {
    return null;
  }

  return (
    // <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
    <div className="h-full">
      {/* HR Decision History Column */}
      {hrDecisionHistory.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <div className="h-6 w-6 rounded-xl bg-primary/10 flex items-center justify-center">
              <History className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-black  text-muted-foreground">
              Decision History
            </span>
          </div>
          <div className="space-y-2 h-full">
            {hrDecisionHistory.map((decision) => (
              <HrDecision key={decision.id} decision={decision} />
            ))}
          </div>
        </section>
      )}

      {/* Transcript History Column */}
      {transcriptHistory.length > 0 && (
        <section className="space-y-2 py-2">
          <div className="flex items-center gap-2 px-2 ">
            <div className="h-6 w-6 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 " />
            </div>
            <span className="text-sm font-black  text-muted-foreground">
              Recent Transcripts
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
            {transcriptHistory.map((t, index) => (
              <Button
                key={t.id}
                onClick={() => onTranscriptClick(t.id)}
                variant="outline"
                className="w-full h-auto flex flex-col items-start p-2 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-black text-muted-foreground leading-none">
                    Transcript #{index + 1}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium">Uploaded on</span>
                    <DateDisplay
                      className="font-bold text-foreground text-xs"
                      date={t.generated_at}
                      showTime
                    />
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
