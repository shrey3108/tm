import { useMemo } from "react";
import { EvaluationCard } from "./EvaluationCard";
import { Accordion } from "@/components/ui/accordion";
import type { Criteria } from "@/types/candidateStage";



export type NestedEvaluationData = Record<string, Array<Record<string, Criteria>>>;

interface EvaluationGridProps {
  /** Record of evaluation category name to evaluation data */
  data: Record<string, Criteria> | NestedEvaluationData;
}

/**
 * Grid layout for rendering multiple evaluation cards.
 * 
 */
export function EvaluationGrid({ data }: EvaluationGridProps) {
  // Detect if the current stage is a special stage by checking if data has grouped skills
  const isSpecialStage = useMemo(() => {
    // if data has more than one category and each category has list of cretirias then it is special stage
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    return Object.values(data).some((val) => Array.isArray(val));
  }, [data]);

  // Extract categories and their criteria for special stage layout
  const categories = useMemo(() => {
    if (!isSpecialStage) return [];

    const typedData = data as NestedEvaluationData;
    return Object.entries(typedData).map(([categoryName, criteriaList]) => {
      const list = Array.isArray(criteriaList) ? criteriaList : [];
      const flatItems = list.flatMap((itemObj) => {
        if (!itemObj || typeof itemObj !== "object") return [];
        return Object.entries(itemObj).map(([criteriaName, criteriaVal]) => ({
          name: criteriaName,
          criteria: criteriaVal,
        }));
      });

      return {
        categoryName,
        items: flatItems,
      };
    });
  }, [data, isSpecialStage]);

  // Extract flat items for standard layout
  const flatItems = useMemo(() => {
    if (isSpecialStage) return [];

    const typedData = data as Record<string, Criteria>;
    return Object.entries(typedData || {}).map(([key, value]) => ({
      key,
      criteria: value,
    }));
  }, [data, isSpecialStage]);

  if (isSpecialStage) {
    const gridColsClass = categories.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";
    return (
      <div className={`grid ${gridColsClass} gap-4 items-start w-full`}>
        {categories.map(({ categoryName, items }) => (
          <div
            key={categoryName}
            className="w-full rounded-2xl overflow-hidden transition-all duration-200"
          >
            {/* Heading */}
            <div className="px-3 py-2 bg-muted/10 flex items-center justify-between">
              <h2 className="text-foreground font-extrabold tracking-tight text-base uppercase">
                {categoryName.replace(/_/g, " ")}
              </h2>
            </div>
            {/* Content section containing accordions */}
            <div className="px-2 py-2 bg-card/30 flex flex-col gap-2">
              {items.map(({ name, criteria }) => (
                <Accordion key={name} className="w-full" multiple>
                  <EvaluationCard
                    title={name}
                    reasoning={criteria?.reasoning || ""}
                    score={criteria?.score || 0}
                    confidence={criteria?.confidence || 0}
                  />
                </Accordion>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
      {flatItems.map(({ key, criteria }) => (
        <Accordion key={key} className="w-full" multiple>
          <EvaluationCard
            title={key}
            reasoning={criteria?.reasoning || ""}
            score={criteria?.score || 0}
            confidence={criteria?.confidence || 0}
          />
        </Accordion>
      ))}
    </div>
  );
}

