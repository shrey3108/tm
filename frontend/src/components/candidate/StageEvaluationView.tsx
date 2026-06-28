import { Button } from "@/components/ui/button";
import { History, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvaluationGrid } from "@/components/candidate/EvaluationGrid";
import { StageOverallSummary, type OverallSummaryData } from "@/components/candidate/StageOverallSummary";
import { CandidateHistoryGrid } from "@/components/candidate/stage/CandidateHistoryGrid";
import type { EvaluationRead, EvaluationHistoryRead } from "@/types/candidateStage";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import type { Transcript } from "@/types/transcript";
import type { Job } from "@/types/job";
import { GithubLogo } from "@/components/logo";
import { useCandidateTestPaper, useDownloadCandidateAssignedTaskFile } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { toast } from "sonner";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

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
  candidateId?: string;
  githubUrl?: string | null;
  job?: Job | null;
  onPaperChange?: () => void;
  stageName?: string;
  candidateName?: string;
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
  candidateId,
  githubUrl,
  stageName,
}: StageEvaluationViewProps) {
  const { data: assignedPaper } = useCandidateTestPaper(candidateId);
  const { refetch: downloadFile, loading: isDownloading } = useDownloadCandidateAssignedTaskFile(
    assignedPaper ? candidateId : null,
    { enabled: false }
  );

  const handleViewTaskPaper = async () => {
    if (!assignedPaper) return;
    try {
      toast.info("Downloading task file...");
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

  const isGithubUploaded = !!githubUrl &&
    githubUrl.toLowerCase().startsWith("http") &&
    (githubUrl.toLowerCase().includes("github.com") || githubUrl.toLowerCase().includes("gitlab.com"));

  const versionNumber =
    evaluationHistory.length -
    Math.max(0, evaluationHistory.findIndex((h) => h.id === evaluation.id));
  const latestHrDecision = hrDecisionHistory[0]?.decision.toLowerCase();
  const canTakeDecision = !latestHrDecision || latestHrDecision.includes("may be") || latestHrDecision === "maybe";

  return (
    <>
      <div className="flex items-center justify-end px-4 mb-2 gap-3">
        {stageName && (
          stageName.toLowerCase().includes("technical") ||
          stageName.toLowerCase().includes("practical") ||
          stageName.toLowerCase().includes("coding") ||
          stageName.toLowerCase().includes("test")
        ) && (
            <>
              {isGithubUploaded && githubUrl && (
                <HoverCard>
                  <HoverCardTrigger delay={10} closeDelay={10}
                    render={(props) => (
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg"
                        onClick={(e) => {
                          if (props.onClick) props.onClick(e);
                          window.open(githubUrl, "_blank");
                        }}
                      >
                        <GithubLogo className="h-4 w-4" />
                      </Button>
                    )}
                  />
                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                    Github Submmited link
                  </HoverCardContent>
                </HoverCard>
              )}
              {assignedPaper && (
                <HoverCard>
                  <HoverCardTrigger delay={10} closeDelay={10}
                    render={(props) => (
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg"
                        onClick={(e) => {
                          if (props.onClick) props.onClick(e);
                          handleViewTaskPaper();
                        }}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  />
                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                    View Task file
                  </HoverCardContent>
                </HoverCard>
              )}
            </>
          )}

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
