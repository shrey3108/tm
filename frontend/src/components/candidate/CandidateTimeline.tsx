import React, { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Clock, Loader2, ChevronRight } from "lucide-react";
import { useCandidateTimelineQuery } from "@/hooks/queries/candidates";
import type { TimelineEvent } from "@/types/candidate";
import type { Job } from "@/types/job";
import type { CandidateAnalysis } from "@/types/admin";
import { TimelineEventDetailModal } from "./TimelineEventDetailModal";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";
import { useTimelineStatus } from "./useTimelineStatus";
import { TimelineCard } from "./TimelineCard";
import { isEventOngoing } from "./timelineStatusUtils";



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
  isPolling: boolean;
  onTranscriptDisableChange?: (disabled: boolean) => void;
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
  isPolling,
  onTranscriptDisableChange,
}: CandidateTimelineProps) {
  const { data: events, isLoading } = useCandidateTimelineQuery(candidateId, jobId);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navigate = useNavigate();

  const { firstRejectedIndex } = useTimelineStatus({
    events,
    stageId,
    currentStage,
    isPolling,
    onTranscriptDisableChange,
  });

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
    if (!event.stage_id) {
      onSelectStage?.("Resume Screening");
    } else {
      if (event.event_type === "stage" && event.title) {
        onSelectStage?.(event.title);
      } else {
        setIsModalOpen(true);
      }
    }
  };

  if (events?.events.length === 0) return null;

  if (isLoading) {
    return (
      <div className={cn("w-full py-6 flex flex-col items-center justify-center min-h-[150px] gap-3", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
          Synchronizing Timeline...
        </span>
      </div>
    );
  }

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
            const isSelected = event.title === selectedStage;
            const isAfterRejection = firstRejectedIndex !== -1 && index > (firstRejectedIndex ?? 0);
            const isActuallyActive = events?.current_stage
              ? event.title === events.current_stage
              : isEventOngoing(event.result);

            return (
              <React.Fragment key={index}>
                <TimelineCard
                  event={event}
                  isSelected={isSelected}
                  isAfterRejection={isAfterRejection}
                  isActuallyActive={isActuallyActive}
                  onClick={() => {
                    const targetStage = event.stage_id ? (event.title || "Resume Screening") : "Resume Screening";
                    const slug = slugify(targetStage);
                    navigate(`../${slug}`, {
                      relative: "path",
                      state: { job, candidate },
                    });
                    handleEventClick(event);
                  }}
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

      <TimelineEventDetailModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        event={selectedEvent}
      />
    </div>
  );
}
