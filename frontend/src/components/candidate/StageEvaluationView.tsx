import { Button } from "@/components/ui/button";
import { History, AreaChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvaluationGrid } from "@/components/candidate/EvaluationGrid";
import { StageOverallSummary, type OverallSummaryData } from "@/components/candidate/StageOverallSummary";
import { CandidateHistoryGrid } from "@/components/candidate/stage/CandidateHistoryGrid";
import type { EvaluationRead, EvaluationHistoryRead } from "@/types/candidateStage";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";
import type { Transcript } from "@/types/transcript";
import type { Job } from "@/types/job";
import { GithubLogo } from "@/components/logo";
import { useCandidateTestPaper } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Switch } from "@/components/ui/switch";
import { CandidateAssignPaperButton } from "@/components/shared/candidate/CandidateAssignPaperButton";
import type { CandidateAnalysis } from "@/types/admin";
import { slugify } from "@/utils/slug";

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
  requiredInputs?: string[];
  showChart: boolean;
  onShowChartChange: (show: boolean) => void;
  candidate: CandidateAnalysis | null | undefined
}

export interface ChartDataPoint {
  name: string;
  jd: number;
  project: number;
}

export function getChartData(evaluationData: any): ChartDataPoint[] {
  if (!evaluationData || typeof evaluationData !== "object") return [];

  const skillsMap: Record<string, { jd: number; project: number }> = {};

  // Helper to extract criteria entries
  const extractSkills = (skillsList: any[], field: "jd" | "project") => {
    if (!Array.isArray(skillsList)) return;
    skillsList.forEach((itemObj) => {
      if (itemObj && typeof itemObj === "object") {
        Object.entries(itemObj).forEach(([key, criteriaVal]: [string, any]) => {
          // Ignore structural properties like strengths, weaknesses, followups, summary
          if (
            key !== "strengths" &&
            key !== "weaknesses" &&
            key !== "suggested_followups" &&
            key !== "alignment_review" &&
            criteriaVal &&
            typeof criteriaVal === "object" &&
            typeof criteriaVal.score === "number"
          ) {
            const normalizedKey = key.replace(/_/g, " ").toUpperCase();
            if (!skillsMap[normalizedKey]) {
              skillsMap[normalizedKey] = { jd: 0, project: 0 };
            }
            skillsMap[normalizedKey][field] = criteriaVal.score;
          }
        });
      }
    });
  };

  extractSkills(evaluationData["JD Skills"], "jd");
  extractSkills(evaluationData["Project requirements skills"], "project");

  // Fallback: If evaluationData is flat (like standard structure) instead of grouped under "JD Skills"
  if (Object.keys(skillsMap).length === 0) {
    Object.entries(evaluationData).forEach(([key, criteriaVal]: [string, any]) => {
      if (
        key !== "strengths" &&
        key !== "weaknesses" &&
        key !== "suggested_followups" &&
        key !== "alignment_review" &&
        criteriaVal &&
        typeof criteriaVal === "object" &&
        typeof criteriaVal.score === "number"
      ) {
        let normalizedKey = key;
        let field: "jd" | "project" = "jd";

        if (key.includes("(JD Skills)")) {
          normalizedKey = key.replace(" (JD Skills)", "");
          field = "jd";
        } else if (key.includes("(Task Skills)")) {
          normalizedKey = key.replace(" (Task Skills)", "");
          field = "project";
        } else {
          normalizedKey = key;
          field = "jd";
        }

        normalizedKey = normalizedKey.replace(/_/g, " ").toUpperCase();
        if (!skillsMap[normalizedKey]) {
          skillsMap[normalizedKey] = { jd: 0, project: 0 };
        }
        skillsMap[normalizedKey][field] = criteriaVal.score;
      }
    });
  }

  return Object.entries(skillsMap).map(([name, scores]) => ({
    name,
    jd: scores.jd,
    project: scores.project,
  })).sort((a, b) => a.name.localeCompare(b.name));
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
  requiredInputs,
  showChart,
  onShowChartChange,
  job,
  candidate
}: StageEvaluationViewProps) {
  const { data: assignedPaper } = useCandidateTestPaper(candidateId);
  /*
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
 */
  const isGithubUploaded = !!githubUrl &&
    githubUrl.toLowerCase().startsWith("http") &&
    (githubUrl.toLowerCase().includes("github.com") || githubUrl.toLowerCase().includes("gitlab.com"));

  const versionNumber =
    evaluationHistory.length -
    Math.max(0, evaluationHistory.findIndex((h) => h.id === evaluation.id));
  const latestHrDecision = hrDecisionHistory[0]?.decision.toLowerCase();
  const canTakeDecision = !latestHrDecision || latestHrDecision.includes("may be") || latestHrDecision === "maybe";
  const jobSlug = slugify(job?.title);
  return (
    <>
      <div className="flex items-center justify-end px-4 mb-2 gap-3">
        {((requiredInputs
          ? (requiredInputs.includes("question") || requiredInputs.includes("github"))
          : (stageName && (
            stageName.toLowerCase().includes("technical") ||
            stageName.toLowerCase().includes("practical") ||
            stageName.toLowerCase().includes("coding") ||
            stageName.toLowerCase().includes("test")
          )))
        ) && (
            <>
              <div className="flex items-center gap-2 mr-2 bg-muted/20 px-3 py-1 rounded-xl border border-border/50 shadow-sm transition-all duration-200">
                <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground select-none">
                  <AreaChart className="h-3.5 w-3.5 text-primary animate-in fade-in" />
                  Show Chart
                </span>
                <Switch
                  checked={showChart}
                  onCheckedChange={onShowChartChange}
                  size="sm"
                />
              </div>

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
                <CandidateAssignPaperButton candidate={candidate} job={job} jobSlug={jobSlug} variant="ghost"
                  size="icon-sm"
                  className="rounded-lg" iconClassName="h-4 w-4" />
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

      {!showChart && (
        <>
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
      )}
    </>
  );
}
