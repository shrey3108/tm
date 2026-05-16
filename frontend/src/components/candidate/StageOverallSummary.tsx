import { Badge } from "@/components/ui/badge";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Accordion
} from "@/components/ui/accordion"
export interface OverallSummaryData {
  /** Numeric score for this stage (0-5) */
  stage_score: number;
  /** Recommendation label (e.g., "Strongly Recommend") */
  recommendation: string;
  /** Overall AI summary of candidate performance */
  overall_summary: string;
  /** Summary of candidate strengths */
  strength_summary: string[];
  /** Summary of candidate weaknesses */
  weakness_summary: string[];
  /** Suggested followup questions */
  followups: string[];
  /** Overall percentage score (0-100) */
  percentage: number;
}

interface StageOverallSummaryProps {
  /** Summary data to display */
  data: OverallSummaryData;
}

/**
 * Card displaying overall candidate evaluation summary.
 * Includes score, recommendation, strengths, weaknesses, and followup questions.
 */
export function StageOverallSummary({ data }: StageOverallSummaryProps) {
  return (
    <Accordion>
      <AccordionItem>
        <AccordionTrigger className={"hover:no-underline text-black px-2 py-2"}> <div className=" flex flex-wrap gap-4 items-center justify-between">
          <h2 className="text-sm font-black tracking-tight">Overall Summary</h2>
          <div className="flex gap-3">
            <Badge className="px-2 h-8" variant="outline">
              <span className="font-semibold">{data.percentage}%</span>
              <span className="ml-1 text-muted-foreground">Overall</span>
            </Badge>
            <Badge className="px-2 h-8" variant="outline">
              <span>
                Stage Score <span className="font-semibold">{data.stage_score.toFixed(2)}</span>
                <span className="text-muted-foreground">/5.0</span>
              </span>
            </Badge>
          </div>
        </div></AccordionTrigger>
        <AccordionContent>
          <div className="space-y-6">
            <div>
              <span className="text-xs font-black text-muted-foreground tracking-wide block mb-1 uppercase">Summary</span>
              <p className="text-base font-medium leading-relaxed">{data.overall_summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SummaryList
                title="Strengths"
                items={data.strength_summary}
                titleColor="text-green-600"
              />
              <SummaryList
                title="Weaknesses"
                items={data.weakness_summary}
                titleColor="text-red-600"
              />
            </div>
          </div>

          <SummaryList
            title="Suggest Followups"
            items={data.followups}
            className="pt-6 border-t border-primary/10"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/**
 * Reusable component for summary lists (Strengths, Weaknesses, Followups)
 */
function SummaryList({
  title,
  items,
  titleColor = "text-muted-foreground",
  className
}: {
  title: string;
  items: string[];
  titleColor?: string;
  className?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className={className}>
      <span className={`text-xs font-black tracking-wide block mb-2 uppercase ${titleColor}`}>
        {title}
      </span>
      <ul className="list-disc pl-5 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm font-medium leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
