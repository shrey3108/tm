import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCandidateAssociateResultsQuery } from "@/hooks/queries/candidates/useCandidateStagesQueries";

import { isEventCompleted, isEventOngoing, isEventPending } from "./timelineStatusUtils";
import type { TimelineEvent } from "@/types/candidate";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { DateDisplay } from "@/components/shared/DateDisplay";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";
import { AssociateEvaluationsDialog } from "./AssociateEvaluationsDialog";
import { Button } from "@/components/ui/button";


interface TimelineCardProps {
  event: TimelineEvent;
  /** Whether this card's stage is the one currently selected in the UI. */
  isSelected: boolean;
  /** Whether this card appears after a rejected stage (greyed-out). */
  isAfterRejection: boolean;
  /** Whether this is the real "current" stage the candidate is on. */
  isActuallyActive: boolean;
  isDisabled?: boolean;
  onClick: () => void;
}



export const TimelineCard = React.memo(function TimelineCard({
  event,
  isSelected,
  isAfterRejection,
  isActuallyActive,
  isDisabled,
  onClick,
}: TimelineCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: associateResults } = useCandidateAssociateResultsQuery(event.stage_id);
  // @ts-ignore
  const _completed = isEventCompleted(event.result);
  const ongoing = isEventOngoing(event.result);
  const pending = isEventPending(event.result);
  // console.log(event);
  return (
    <>
      <Card
        onClick={isDisabled ? undefined : onClick}
        className={cn(
          "flex min-w-[230px] flex-col p-2.5 gap-1.5 shrink-0 border transition-all",
          isDisabled
            ? "opacity-50 cursor-not-allowed border-muted-foreground/10 bg-card"
            : cn(
              "cursor-pointer hover:border-primary/50",
              isSelected
                ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20 scale-[1.02]"
                : ongoing
                  ? "border-primary/40 bg-primary/5"
                  : "border-muted-foreground/10 bg-card hover:bg-muted/30",
            ),
          isAfterRejection && "opacity-40 grayscale-[0.5]",
        )}
      >
        {/* Title + current badge */}
        <div className="space-y-1 min-h-[38px]">
          <div className="flex items-center justify-between gap-2">
            <HoverCard>
              <HoverCardTrigger>
                <h4
                  className={cn(
                    "font-black text-xs text-wrap line-clamp-1",
                    isSelected
                      ? "text-black font-bold dark:text-white"
                      : pending
                        ? "text-foreground"
                        : "text-foreground/90")}
                >{event.title}</h4>
              </HoverCardTrigger>
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                {event.title}
              </HoverCardContent>
            </HoverCard>

            {isActuallyActive && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-primary/30 font-black uppercase tracking-tighter whitespace-nowrap"
              >
                Current
              </Badge>
            )}
          </div>
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-tighter flex items-center gap-1",
              pending ? "text-foreground/70" : "text-muted-foreground",
            )}
          >
            {event.event_date && (
              <>
                <Calendar className="h-2.5 w-2.5" />
                <DateDisplay date={new Date(event.event_date)} className="text-xs" />
              </>
            )}
          </p>
        </div>

        {/* AI result + HR decision */}
        <div className="pt-1.5 border-t border-border mt-auto">
          <div className="flex flex-col gap-2 min-h-[54px]">
            {event.ai_result && (
              <div className="flex items-center justify-start gap-2">
                <span className="text-xs font-bold uppercase tracking-tight text-foreground/60">
                  AI result:
                </span>
                <CandidateStatusBadge status={event.ai_result || "N/A"} />
                {event.score !== null && event.score !== undefined && (
                  <span className="text-xs font-bold ">
                    {event.score.toFixed(1)}
                    {event.title !== "Resume Screening" ? "/5" : "%"}
                  </span>
                )}
              </div>
            )}

            {event.hr_decision && (
              <div className="flex items-center justify-start gap-2">
                <span className="text-xs font-bold uppercase tracking-tight text-foreground/60">
                  HR decision:
                </span>
                <CandidateStatusBadge status={event.hr_decision || "N/A"} />
                {event.hr_score !== null && event.hr_score !== undefined && (
                  <span className="text-xs font-bold ">
                    {event.hr_score.toFixed(1)}/5
                  </span>
                )}
              </div>
            )}

            {/* Associate Row */}
            {associateResults && associateResults.total_associates > 0 && associateResults.reviews && associateResults.reviews.length > 0 && (
              <div className="flex items-center justify-start gap-1">
                <span className="text-xs font-bold uppercase tracking-tight text-foreground/60">
                  Associate:
                </span>

                {/*  */}
                {/*  */}

                {/* {(() => {
                  const firstReview = associateResults.reviews[0];
                  return (
                    <>
                      <CandidateStatusBadge status={firstReview.result || firstReview.status} />
                      {firstReview.weighted_result_out_of_5 !== null && firstReview.weighted_result_out_of_5 !== undefined && (
                        <span className="text-xs font-bold">
                          {firstReview.weighted_result_out_of_5.toFixed(1)}/5
                        </span>
                      )}
                      <span className="text-xs text-foreground/60 truncate max-w-[80px]">
                        ({firstReview.associate_name})
                      </span>
                    </>
                  );
                })()} */}

                {/*  we want to display submitted/total count for multiple associates: */}
                <span className="text-xs">({associateResults.submitted_count}/{associateResults.total_associates})</span>


                <Button
                  type="button" className={"size-4"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDialogOpen(true);
                  }}
                  variant={"outline"}
                  size={"icon-sm"}
                >
                  <Info className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <AssociateEvaluationsDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        associateResults={associateResults}
      />
    </>
  );
});
