import { cn } from "@/lib/utils";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface EvaluationCardProps {
  /** Title of the evaluation category */
  title: string;
  /** AI-generated reasoning for the evaluation */
  reasoning: string;
  /** Score given (out of maxScore) */
  score: number;
  /** Maximum possible score (default: 5) */
  maxScore?: number;
  /** Confidence level of the evaluation (0-1) */
  confidence: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card displaying single evaluation category with score, reasoning, and confidence.
 * Used in the evaluation grid to show AI assessment results.
 */
export function EvaluationCard({
  title,
  reasoning,
  score,
  maxScore = 5,
  // confidence,
  className,
}: EvaluationCardProps) {
  return (
    <AccordionItem value={title} className={cn(className)}>
      <AccordionTrigger className={"hover:no-underline text-black px-2 py-2"}>
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold capitalize tracking-tight">
            {title.replace(/_/g, " ")}
          </h3>
          <div className="flex items-center gap-1 text-foreground">
            <span className="font-bold capitalize">Score</span>
            <span className="text-sm font-semibold">({score}/{maxScore})</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-1">
          <p>
            <span className="text-sm font-bold capitalize text-muted-foreground ">Reasoning:</span>
            <span className="text-sm text-foreground/80 leading-relaxed font-medium ">
              {" "} {reasoning}
            </span>
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>

  );
}
