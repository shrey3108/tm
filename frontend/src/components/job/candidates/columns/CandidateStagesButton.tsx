import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import type { CandidateAnalysis } from "@/types/admin";
import type { Job } from "@/types/job";
import { Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";


interface CandidateStagesButtonProps {
    candidate: CandidateAnalysis;
    jobSlug: string | undefined;
    job: Job | null;
}

export function CandidateStagesButton({ candidate, jobSlug, job }: CandidateStagesButtonProps) {
    const navigate = useNavigate();
    const handleNavigate = () => {
        const candidateFullName = slugify(`${candidate.first_name || ""} ${candidate.last_name || ""}`);
        const currentStageName = candidate.current_stage?.template_name || "Resume Screening";
        const stageSlug = slugify(currentStageName);

        navigate(`/dashboard/jobs/${jobSlug}/candidates/${candidateFullName}/stages/${stageSlug}`, {
            state: {
                candidate: candidate,
                jobSlug: jobSlug,
                job
            }
        });
    };

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
                        // disabled={!candidate.pipeline || !candidate.is_parsed || isLoading}
                        disabled={!candidate.pipeline || !candidate.is_parsed}
                    >
                        <Layers className="h-4 w-4 shrink-0" />
                    </Button>
                )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Stages
            </HoverCardContent>
        </HoverCard>
    );
}