import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { CandidateAnalysis } from "@/types/admin";
import { slugify } from "@/utils/slug";
import type { Job } from "@/types/job";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";


interface CandidateAssignPaperButtonProps extends Omit<ComponentPropsWithoutRef<typeof Button>, "onClick"> {
    candidate: CandidateAnalysis | null | undefined;
    jobSlug: string | undefined;
    job: Job | null | undefined;
    iconClassName?: string;
    buttonClassName?: string;
}

/**
 * CandidateAssignPaperButton component - displays a button to navigate to the candidate's assign question paper page
 * @param candidate - Candidate information
 * @param jobSlug - Job slug
 * @param job - Job information
 * @param iconClassName - Icon classes
 * @param buttonClassName - Button classes
 * @returns CandidateAssignPaperButton component
 */
export function CandidateAssignPaperButton({
    candidate,
    jobSlug,
    job,
    iconClassName,
    buttonClassName,
    className,
    disabled,
    children,
    ...props
}: CandidateAssignPaperButtonProps) {
    const navigate = useNavigate();
    const handleNavigate = () => {
        if (!candidate) return;
        const candidateFullName = slugify(`${candidate.first_name || ""} ${candidate.last_name || ""}`);
        const currentStageName = candidate.current_stage?.template_name || "Resume Screening";
        const stageSlug = slugify(currentStageName);

        // redirect to candidate assign question paper in read-only mode
        navigate(`/dashboard/jobs/${jobSlug}/candidates/${candidateFullName}/stages/${stageSlug}/send-paper`, {
            state: {
                candidate: candidate,
                candidateId: candidate.id,
                candidateName: `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim(),
                jobSlug: jobSlug,
                job,
                stageId: candidate.current_stage?.stage_id,
                readOnly: true
            }
        });
    };

    return (
        <HoverCard>
            <HoverCardTrigger
                render={(hoverProps) => (
                    <Button
                        variant="secondary"
                        size="sm"
                        {...props}
                        {...hoverProps}
                        className={cn(
                            (!buttonClassName && !className) && "h-9 w-9 p-0 rounded-xl bg-muted/50 hover:bg-gray-200/60 text-foreground border border-muted-foreground/10 flex items-center justify-center shrink-0",
                            buttonClassName,
                            className
                        )}
                        onClick={handleNavigate}
                        disabled={disabled !== undefined ? disabled : !candidate}
                    >
                        {children || <FileText className={cn("h-4 w-4 shrink-0 ", iconClassName)} />}
                    </Button>
                )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Question Paper
            </HoverCardContent>
        </HoverCard>
    );
}