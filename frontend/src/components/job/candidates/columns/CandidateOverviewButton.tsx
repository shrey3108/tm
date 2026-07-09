import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import type { CandidateAnalysis } from "@/types/admin";
import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

interface CandidateOverviewButtonProps {
  candidate: CandidateAnalysis;
  jobSlug: string | undefined;
}

export function CandidateOverviewButton({ candidate, jobSlug }: CandidateOverviewButtonProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    const candidateFullName = slugify(`${candidate.first_name || ""} ${candidate.last_name || ""}`);
    navigate(`/dashboard/jobs/${jobSlug}/candidates/${candidateFullName}/overview`, {
      state: {
        candidateId: candidate.id,
        candidate,
      },
    });
  };



  const isCompletedAllRounds = !!candidate.pipeline && candidate.pipeline.length > 0 && candidate.pipeline.every(
    (stage) => (stage.status === "completed" || stage.status === "failed") && stage.hr_decision !== "pending"
  );

  return (
    <HoverCard>
      <HoverCardTrigger
        render={(props) => (
          <Button
            {...props}
            variant="secondary"
            size="sm"
            className="h-7 w-7 p-0 rounded-xl bg-muted/50 hover:bg-gray-200/60 text-foreground border border-muted-foreground/10 flex items-center justify-center shrink-0"
            onClick={handleNavigate}
            disabled={!candidate.is_parsed || !isCompletedAllRounds}
          >
            <Eye className="h-4 w-4 shrink-0" />
          </Button>
        )}
      />
      <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
        Results Overview
      </HoverCardContent>
    </HoverCard>
  );
}
