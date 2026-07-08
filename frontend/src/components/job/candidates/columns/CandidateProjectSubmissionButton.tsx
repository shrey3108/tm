import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import type { CandidateAnalysis } from "@/types/admin";
import { Code2 } from "lucide-react";


interface CandidateProjectSubmissionButtonProps {
    candidate: CandidateAnalysis;
    onClick: (e: React.MouseEvent) => void
}

export function CandidateProjectSubmissionButton({ candidate, onClick }: CandidateProjectSubmissionButtonProps) {
    const isStageTechnicalPractical = candidate.current_stage?.required_inputs.includes("github");
    const isEmailSent = (candidate.email_sent_count !== undefined && candidate.email_sent_count >= 1) || candidate.test_email_sent === true;
    const isSubmittedOrEvaluated = candidate.current_stage?.status === "submitted" || candidate.current_stage?.status === "processing" || candidate.current_stage?.status === "completed";
    const isSubmissionEnabled = isStageTechnicalPractical && isEmailSent && !isSubmittedOrEvaluated;
    return (
        <HoverCard>
            <HoverCardTrigger
                render={(props) => (
                    <Button
                        {...props}
                        variant="secondary"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-xl bg-muted/50 hover:bg-gray-200/60 text-foreground border border-muted-foreground/10 flex items-center justify-center shrink-0"
                        onClick={(e) => {
                            if (props.onClick) props.onClick(e);
                            onClick(e);
                        }}
                        disabled={!isSubmissionEnabled}
                    >
                        <Code2 className="h-4 w-4 shrink-0" />
                    </Button>
                )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Project Submission
            </HoverCardContent>
        </HoverCard>
    );
}