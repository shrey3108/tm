import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { Badge } from "@/components";
import { EvaluationGrid } from "@/components/candidate/EvaluationGrid";
import { StageOverallSummary, type OverallSummaryData } from "@/components/candidate/StageOverallSummary";
import { CandidateHistoryGrid } from "@/components/candidate/CandidateHistoryGrid";
import type { EvaluationRead, EvaluationHistoryRead } from "@/types/candidateStage";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import type { Transcript } from "@/types/transcript";

interface StageEvaluationViewProps {
  /** The current evaluation data to display. */
  evaluation: EvaluationRead;
  /** History of previous evaluations for this stage. */
  evaluationHistory: EvaluationHistoryRead[];
  /** Callback to open the evaluation history modal. */
  onOpenHistory: () => void;
  /** Processed summary data for the overall stage performance. */
  transformedOverall: OverallSummaryData | null;
  /** History of HR decisions for the candidate in this stage/job. */
  hrDecisionHistory: HrDecisionHistoryItem[];
  /** History of transcripts associated with this candidate. */
  transcriptHistory: Transcript[];
  /** Callback triggered when a transcript item is clicked. */
  onTranscriptClick: (id: string) => void;
}

/**
 * Component that displays the full evaluation details for a specific interview stage.
 * Includes score grids, overall summaries, and history of decisions/transcripts.
 */
export function StageEvaluationView({
  evaluation,
  evaluationHistory,
  onOpenHistory,
  transformedOverall,
  hrDecisionHistory,
  transcriptHistory,
  onTranscriptClick,
}: StageEvaluationViewProps) {
  const versionNumber =
    evaluationHistory.length -
    Math.max(0, evaluationHistory.findIndex((h) => h.id === evaluation.id));
  const latestHrDecision = hrDecisionHistory[0]?.decision.toLowerCase();
  const canTakeDecision = !latestHrDecision || latestHrDecision.includes("may be") || latestHrDecision === "maybe";

  return (
    <>
      <div className="flex items-center justify-end px-4 mb-2 gap-3">
        {canTakeDecision && (
          <Button
            variant="outline"
            onClick={() =>
              window.scroll({
                top: document.body.scrollHeight,
                behavior: "smooth",
              })
            }
          >
            Go to Actions
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenHistory}
          className="rounded-xl border-primary/20 hover:bg-primary/5 font-bold shadow-sm transition-all active:scale-95"
        >
          <History className="h-4 w-4 mr-2 text-primary" />
          Evaluation History
          <Badge variant="outline" className="ml-2">
            V{versionNumber}
          </Badge>
        </Button>
      </div>
      <EvaluationGrid data={evaluation.evaluation_data} />

      <div className="mx-auto space-y-1">
        {/* Section 1: Overall Summary */}
        {transformedOverall && <StageOverallSummary data={transformedOverall} />}

        {/* Section 2: Histories Grid */}
        <CandidateHistoryGrid
          hrDecisionHistory={hrDecisionHistory}
          transcriptHistory={transcriptHistory}
          onTranscriptClick={onTranscriptClick}
          transcript_id={evaluation.transcript_id}
        />
      </div>
    </>
  );
}
