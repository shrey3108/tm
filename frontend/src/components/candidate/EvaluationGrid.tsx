import { EvaluationCard } from "./EvaluationCard";
import {
  Accordion,
} from "@/components/ui/accordion"
export interface EvaluationData {
  /** AI reasoning for this evaluation */
  reasoning: string;
  /** Score given (out of 5) */
  score: number;
  /** Confidence level (0-1) */
  confidence: number;
}

interface EvaluationGridProps {
  /** Record of evaluation category name to evaluation data */
  data: Record<string, EvaluationData>;
}

/**
 * Grid layout for rendering multiple evaluation cards.
 * Maps over data object to display category-wise AI evaluations.
 */
export function EvaluationGrid({ data }: EvaluationGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
      {Object.entries(data).map(([key, item]) => (
        <Accordion key={key} className="w-full" multiple>
          <EvaluationCard
            key={key}
            title={key}
            reasoning={item.reasoning}
            score={item.score}
            confidence={item.confidence}
          />
        </Accordion>
      ))}
    </div>
  );
}
