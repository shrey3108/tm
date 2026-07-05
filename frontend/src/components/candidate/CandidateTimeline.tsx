import React, { useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Clock, ChevronRight } from "lucide-react";
import { useCandidateTimelineQuery } from "@/hooks/queries/candidates";
import type { TimelineEvent } from "@/types/candidate";
import type { Job } from "@/types/job";
import type { CandidateAnalysis } from "@/types/admin";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";
import { useTimelineStatus } from "./timeline/useTimelineStatus";
import { TimelineCard } from "./timeline/TimelineCard";
import { isEventOngoing } from "./timeline/timelineStatusUtils";

interface CandidateTimelineProps {
  candidateId?: string;
  jobId?: string;
  className?: string;
  onSelectStage?: (stageName: string) => void;
  selectedStage?: string;
  job?: Job;
  candidate?: CandidateAnalysis;
  currentStage: string;
  stageId: string | undefined;
}

export function CandidateTimeline({
  candidateId,
  jobId,
  className,
  onSelectStage,
  selectedStage,
  job,
  candidate,
  currentStage,
  stageId,
}: CandidateTimelineProps) {
  const { data: events } = useCandidateTimelineQuery(candidateId, jobId);

  const navigate = useNavigate();

  const { firstRejectedIndex } = useTimelineStatus({
    events,
    stageId,
    currentStage,
  });

  const currentStageIndex = useMemo(
    () =>
      events?.events.findIndex((e) =>
        events.current_stage
          ? e.title === events.current_stage
          : isEventOngoing(e.result),
      ) ?? -1,
    [events],
  );

  const handleEventClick = (event: TimelineEvent) => {
    const stageName = event.title || "Resume Screening";


    // Navigate to the stage route
    navigate(`../${slugify(stageName)}`, {
      relative: "path",
      state: { job, candidate },
      replace: true
    });

    // Select stage or open detail modal
    if (!event.stage_id || (event.event_type === "stage" && event.title)) {
      onSelectStage?.(stageName);
    }
  };

  if (events?.events.length === 0) return null;

  return (
    <div className={cn("w-full py-2", className)}>
      <div className="px-4 mb-2 flex justify-between items-center">
        <h3 className="text-xs font-black text-muted-foreground flex items-center gap-2 w-full">
          <Clock className="h-3 w-3" />
          Hiring Journey Timeline
        </h3>
      </div>
      <ScrollArea className="w-full whitespace-nowrap rounded-md border-0">
        <div className="flex w-max space-x-1 p-1">
          {events?.events.map((event, index) => {
            const isAfterRejection = firstRejectedIndex !== -1 && index > firstRejectedIndex;
            const isActuallyActive = events.current_stage
              ? event.title === events.current_stage
              : isEventOngoing(event.result);
            const isFutureStage = currentStageIndex !== -1 && index > currentStageIndex;
            const isAiPending = event.ai_result?.toLowerCase().includes("pending");

            return (
              <React.Fragment key={index}>
                <TimelineCard
                  event={event}
                  isSelected={event.title === selectedStage}
                  isAfterRejection={isAfterRejection}
                  isActuallyActive={isActuallyActive}
                  isDisabled={isFutureStage || (isAiPending && !isActuallyActive)}
                  onClick={() => handleEventClick(event)}
                />
                {index < events.events.length - 1 && (
                  <div className="flex items-center justify-center shrink-0 self-center">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

