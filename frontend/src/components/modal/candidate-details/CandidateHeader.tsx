import { User } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import type { CandidateResponse } from "@/types/resume";
import type { CandidateAnalysis } from "@/types/admin";
import { AnalysisStats } from "./AnalysisStats";
import { AnalysisTabs, type AnalysisTab } from "./AnalysisTabs";

/**
 * Props for {@link CandidateHeader}.
 */
interface CandidateHeaderProps {
  candidate: CandidateResponse | CandidateAnalysis;
  activeTab: AnalysisTab;
  setActiveTab: (tab: AnalysisTab) => void;
  passing_threshold: number;

}

/**
 * Dialog title section that displays the candidate's avatar icon and full name.
 * Renders the last name in the primary accent color.
 */
export function CandidateHeader({ candidate, activeTab, setActiveTab, passing_threshold }: CandidateHeaderProps) {
  return (
    <DialogTitle className="flex flex-row items-center justify-between gap-3 pr-10 sm:items-center sm:gap-4 font-sans">

      <div className="px-2 py-1.5 sm:px-4  border-muted-foreground/10 bg-muted/20 flex  items-start justify-center gap-3 self-center">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 sm:h-11 sm:w-11 ">
          <User className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="flex min-w-0 flex-col text-left gap-1">
          <span className="text-sm font-bold sm:text-sm md:text-xl ">
            Candidate Profile
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground sm:text-sm md:text-xl ">
            {candidate.first_name}{" "}
            {candidate.last_name}
          </span>
        </div>

      </div>
      <div className="flex flex-col gap-2">

        <AnalysisStats
          candidate={candidate}
          activeTab={activeTab}
          onVersionClick={() => setActiveTab("version-result")}
          passing_threshold={passing_threshold}
        />

        <div className="flex w-full items-center justify-center gap-3">
          <AnalysisTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </div>
    </DialogTitle >
  );
}
