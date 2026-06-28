import { CheckCircle2, XCircle } from "lucide-react";
import type { CandidateResponse } from "@/types/resume";
import type { CandidateAnalysis } from "@/types/admin";
import { DEFAULT_PASSING_THRESHOLD } from "@/constants";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";

/**
 * Props for {@link AnalysisStats}.
 */
interface AnalysisStatsProps {
  candidate: CandidateResponse | CandidateAnalysis;
  onVersionClick?: () => void;
  activeTab?: string;
  passing_threshold?: number;
}

/**
 * Compact stats bar showing the candidate's match percentage, pass/fail status
 * and the job version used for analysis.
 */
export function AnalysisStats({
  candidate,
  // onVersionClick,
  // activeTab,
  passing_threshold = DEFAULT_PASSING_THRESHOLD,
}: AnalysisStatsProps) {
  const analysis = candidate.resume_analysis;
  const isPassed =
    candidate.pass_fail === true ||
    String(candidate.pass_fail).toLowerCase() === "pass" ||
    (candidate.resume_score ?? 0) >= passing_threshold;
  // const isVersionTab = activeTab === "version-result";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-sm font-bold text-muted-foreground  whitespace-nowrap">
          Match Percentage
        </span>
        <span className="text-sm font-semibold">
          {analysis?.match_percentage || 0}%
        </span>
      </div>

      <div className="h-4 w-px bg-muted-foreground/20" />

      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-sm font-bold text-muted-foreground  whitespace-nowrap">
          Result
        </span>
        <CandidateStatusBadge status={isPassed ? "pass" : "fail"} icon={isPassed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} />
      </div>

      <div className="h-4 w-px bg-muted-foreground/20" />

      <div
        className={`flex items-center gap-2 rounded-lg py-1 px-2 transition-all outline-none `}
      >
        <span className="text-sm font-bold text-muted-foreground  whitespace-nowrap">
          Analysis Version
        </span>
        <span className="text-sm font-semibold">
          V{(candidate as any)?.applied_version_number || "N/A"}
        </span>
      </div>
    </div>
  );
}
