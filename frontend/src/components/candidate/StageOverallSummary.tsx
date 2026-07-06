import { Badge } from "@/components/ui/badge";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Accordion
} from "@/components/ui/accordion"
import type { CategorizedStringItem, CategorizedStringArrayItem } from "@/types/candidateStage";

/** Simple flat items or categorized items grouped by sub-heading */
type SummaryItems = string[] | CategorizedStringArrayItem[];
type SummaryText = string | CategorizedStringItem[];

export interface OverallSummaryData {
  /** Numeric score for this stage (0-5) */
  stage_score: number;
  /** Recommendation label (e.g., "Strongly Recommend") */
  recommendation: string;
  /** Overall AI summary of candidate performance — simple string or categorized array */
  overall_summary?: SummaryText;
  /** Summary of candidate strengths — flat list or categorized */
  strength_summary?: SummaryItems;
  /** Summary of candidate weaknesses — flat list or categorized */
  weakness_summary?: SummaryItems;
  /** Suggested followup questions — flat list or categorized */
  followups?: SummaryItems;
  /** Overall percentage score (0-100) */
  percentage: number;
  /** GitHub specific highlights */
  github_highlights?: Record<string, string[]>;
}

interface StageOverallSummaryProps {
  /** Summary data to display */
  data: OverallSummaryData;
}


/** Check if the summary text is in the categorized format (array of {category: text} objects) */
function isCategorizedText(value: SummaryText): value is CategorizedStringItem[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === "object";
}

/** Check if the items list is in the categorized format (array of {category: string[]} objects) */
function isCategorizedItems(value: SummaryItems): value is CategorizedStringArrayItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    !Array.isArray(value[0]) &&
    typeof value[0] !== "string"
  );
}

/**
 * Checks if the first element of a string array is a standalone "Score: X/Y" entry.
 * If found, returns the formatted score string and the remaining items.
 */
function extractLeadingScore(items: string[]): { score: string | null; remainingItems: string[] } {
  try {
    if (!Array.isArray(items) || items.length === 0) return { score: null, remainingItems: items };

    const first = items[0];
    if (typeof first !== "string") return { score: null, remainingItems: items };

    // Match standalone score entries like "Score: 3.5/5.0", "Score:4/5"
    const match = first.match(/^\s*Score\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/i);

    if (!match) return { score: null, remainingItems: items };

    return {
      score: `${match[1]}/${match[2]}`,
      remainingItems: items.slice(1),
    };
  } catch {
    // play safe
    return { score: null, remainingItems: items };
  }
}



/**
 * Card displaying overall candidate evaluation summary.
 * Includes score, recommendation, strengths, weaknesses, and followup questions.
 * Supports both simple (flat) and categorized (grouped by sub-heading) data formats.
 */
export function StageOverallSummary({ data }: StageOverallSummaryProps) {
  return (
    <Accordion>
      <AccordionItem>
        <AccordionTrigger className={"hover:no-underline px-2 py-2"}> <div className=" flex flex-wrap gap-4 items-center justify-between">
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
            {/* Overall Summary Section */}
            {data.overall_summary && (
              <div>
                <span className="text-sm font-black text-muted-foreground tracking-wide block mb-1 uppercase">Summary</span>
                <OverallSummaryText value={data.overall_summary} />
              </div>
            )}

            {data.github_highlights ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(data.github_highlights).map(([key, items]) => (
                  <SummaryList
                    key={key}
                    title={key}
                    items={items}
                    titleColor="text-black dark:text-white"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SummaryList
                  title="Strengths"
                  items={data.strength_summary || []}
                  titleColor=""
                />
                <SummaryList
                  title="Weaknesses"
                  items={data.weakness_summary || []}
                  titleColor=""
                />
              </div>
            )}
          </div>

          {!data.github_highlights && (
            <SummaryList
              title="Suggest Followups"
              items={data.followups || []}
              className="pt-3 border-t border-primary/10"
            />
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}



/**
 * Renders overall_summary as either a single paragraph (string)
 * or grouped categorized blocks (array of {category: text} objects).
 */
function OverallSummaryText({ value }: { value: SummaryText }) {
  if (!value) return null;

  // Simple string format
  if (!isCategorizedText(value)) {
    return <p className="text-base font-medium leading-relaxed">{value}</p>;
  }

  // Categorized format: array of { "JD Alignment": "text ...", ... }
  return (
    <div className="space-y-3">
      {value.map((item, idx) => {
        const [category, text] = Object.entries(item)[0];
        return (
          <div key={idx}>
            <span className="text-xs font-bold tracking-wide text-primary/80 uppercase block mb-0.5">
              {category}
            </span>
            <p className="text-sm font-medium leading-relaxed">{text}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Reusable component for summary lists (Strengths, Weaknesses, Followups).
 * Handles both flat string[] and categorized {category: string[]}[] formats.
 */
function SummaryList({
  title,
  items,
  titleColor = "text-muted-foreground",
  className
}: {
  title: string;
  items: SummaryItems;
  titleColor?: string;
  className?: string;
}) {
  if (!items || items.length === 0) return null;

  // Flat string[] format // HR stage
  if (!isCategorizedItems(items)) {
    const { score, remainingItems } = extractLeadingScore(items as string[]);
    return (
      <div className={className}>
        <span className={`text-sm font-black tracking-wide block mb-2 uppercase ${titleColor}`}>
          {title}{score && (
            <Badge variant="outline" className="ml-2 text-xs font-semibold px-1.5 py-0 normal-case">
              {score}
            </Badge>
          )}
        </span>
        {remainingItems.length > 0 && (
          <ul className="list-disc pl-5 space-y-1">
            {remainingItems.map((item, i) => (
              <li key={i} className="text-sm font-medium leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Categorized format: array of { "JD Alignment": ["item1", "item2"], ... }
  return (
    <div className={className}>
      <span className={`text-base font-black tracking-wide block mb-2 uppercase ${titleColor}`}>
        {title}
      </span>
      <div className="space-y-3">
        {items.map((categoryObj, idx) => {
          const [category, categoryItems] = Object.entries(categoryObj)[0];
          if (!categoryItems || categoryItems.length === 0) return null;
          const { score: catScore, remainingItems: catRemaining } = extractLeadingScore(categoryItems);
          return (
            <div key={idx}>
              <span className="text-xs font-bold tracking-wide text-muted-foreground/80 block mb-1">
                {category}{catScore && (
                  <Badge variant="outline" className="ml-2 text-xs font-semibold px-1.5 py-0 normal-case">
                    {catScore}
                  </Badge>
                )}
              </span>
              {catRemaining.length > 0 && (
                <ul className="list-disc pl-5 space-y-1">
                  {catRemaining.map((item, i) => (
                    <li key={i} className="text-sm font-medium leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
