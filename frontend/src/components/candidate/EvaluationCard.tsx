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
  reasoning?: string;
  /** Score given (out of maxScore) */
  score?: number | null;
  /** Maximum possible score (default: 5) */
  maxScore?: number;
  /** Confidence level of the evaluation (0-1) */
  confidence?: number;
  /** Additional CSS classes */
  className?: string;
  /** List items if the criteria value is an array of strings */
  listItems?: string[];
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
  listItems,
}: EvaluationCardProps) {
  const hasScore = score !== undefined && score !== null;

  return (
    <AccordionItem value={title} className={cn(className)}>
      <AccordionTrigger className={"hover:no-underline px-2 py-2"}>
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold capitalize tracking-tight text-left">
            {title.replace(/_/g, " ")}
          </h3>
          {hasScore && (
            <div className="flex items-center gap-2 text-foreground">
              <span className="font-bold capitalize">Score</span>
              <span className="text-sm font-semibold">({score.toFixed(1)}/{maxScore.toFixed(1)})</span>
            </div>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2 px-2 pb-2">
          {reasoning && (
            <div className="text-sm text-foreground/80 leading-relaxed font-medium">
              <span className="font-bold capitalize text-muted-foreground block mb-1">Reasoning:</span>
              {reasoning}
            </div>
          )}
          {listItems && listItems.length > 0 && (
            <div>
              {title.toLowerCase() !== "strengths" &&
                title.toLowerCase() !== "weaknesses" &&
                title.toLowerCase() !== "suggested_followups" && (
                  <span className="text-sm font-bold capitalize text-muted-foreground block mb-1">Items:</span>
                )}
              <ul className="list-disc pl-5 space-y-1">
                {listItems.map((item, idx) => (
                  <li key={idx} className="text-sm text-foreground/80 leading-relaxed font-medium">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}