import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { AnalysisContent } from "@/components/modal/candidate-details/AnalysisContent";
import { HrDecision } from "@/components/modal/candidate-details/HrDecision";
import { DecisionHistory } from "@/components/modal/candidate-details/DecisionHistory";
import type { CandidateAnalysis } from "@/types/admin";
import type { HrDecisionHistoryItem } from "@/apis/candidateDecision";

interface ResumeScreeningViewProps {
  /** Detailed candidate analysis data from the AI resume screening. */
  candidateData: CandidateAnalysis;
  /** Whether to show all skills or a truncated list. */
  showAllSkills: boolean;
  /** Callback to toggle the visibility of all skills. */
  setShowAllSkills: (show: boolean) => void;
  /** Optional ID of the job being screened for. */
  jobId?: string;
  /** The most recent HR decision made for this candidate. */
  latestDecision?: HrDecisionHistoryItem;
  /** List of previous HR decisions filtered for the resume screening stage. */
  filteredHistory?: HrDecisionHistoryItem[];
  /** Callback to show the full candidate details modal. */
  onShowMoreClick: () => void;
}

/**
 * Component for the Resume Screening view.
 * Displays AI-generated analysis of a candidate's resume, including skill matching
 * and HR decision history.
 */
export function ResumeScreeningView({
  candidateData,
  showAllSkills,
  setShowAllSkills,
  jobId,
  latestDecision,
  filteredHistory,
  onShowMoreClick,
}: ResumeScreeningViewProps) {
  return (
    <div className="mx-auto">
      <div className="flex justify-end px-4 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onShowMoreClick}
          className="rounded-xl border-primary/20 hover:bg-primary/5 font-bold"
        >
          <Info className="h-4 w-4 mr-2" />
          Show More
        </Button>
      </div>
      <AnalysisContent
        candidate={candidateData}
        showAllSkills={showAllSkills}
        setShowAllSkills={setShowAllSkills}
        jobId={jobId}
      >
        {latestDecision && latestDecision.decision.toLowerCase() !== "may be" && (
          <HrDecision decision={latestDecision} />
        )}
        <DecisionHistory decisions={filteredHistory as HrDecisionHistoryItem[]} />
      </AnalysisContent>
    </div>
  );
}
