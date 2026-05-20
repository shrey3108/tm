import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Clock, Loader2, ChevronRight, Calendar } from "lucide-react";
import { adminCandidateService } from "@/apis/admin/candidate";
import type { HiringTimelineResponse, TimelineEvent } from "@/types/candidate";
import { TimelineEventDetailModal } from "./TimelineEventDetailModal";
import { CandidateStatusBadge, DateDisplay } from "@/components/shared";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";
import { Badge } from "@/components";



interface CandidateTimelineProps {
  candidateId?: string;
  jobId?: string;
  className?: string;
  onSelectStage?: (stageName: string) => void;
  selectedStage?: string;
  job?: any;
  candidate?: any;
  refetch?: number | boolean;
  currentStage: string
  stageId: string | undefined
  isPolling: boolean,
  fetchHistory: () => void,
  setIsPolling: (value: boolean) => void
  setIsJobModalOpen: (value: boolean) => void;
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
  refetch,
  currentStage,
  stageId,
  isPolling,
  // fetchHistory,
  // setIsPolling,
  // setIsJobModalOpen,
  onTranscriptDisableChange
}: CandidateTimelineProps) {
  const [events, setEvents] = useState<HiringTimelineResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navigate = useNavigate();
  useEffect(() => {
    console.log("should refetch", refetch)
    const fetchTimeline = async () => {
      if (!candidateId) return;
      setIsLoading(true);
      try {
        const response = await adminCandidateService.getCandidateTimeline(candidateId, jobId);
        // const sortedEvents = [...response.events]
        // .sort(
        //   (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        // );
        setEvents(response);
      } catch (error) {
        console.error("Failed to fetch timeline:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeline();
  }, [candidateId, jobId, refetch]);

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

  const firstRejectedIndex = useMemo(() => events?.events.findIndex(e => {
    const r = e.result?.toLowerCase() || "";
    return r.includes("fail") || r.includes("failed") || r.includes("rejected") || r.includes("reject");
  }), [events]);

  const activeEventIndex = useMemo(() => events?.events.findIndex(e =>
    (stageId && e.stage_id === stageId) || e.title === currentStage
  ), [events, stageId, currentStage]);

  const previousEvent = useMemo(() => activeEventIndex && activeEventIndex > 0 ? events?.events[activeEventIndex - 1] : null, [events, activeEventIndex]);

  const isPreviousStagePending = useMemo(() => previousEvent ? (() => {
    const r = previousEvent.hr_decision?.toLowerCase() || "";
    const isCompleted = previousEvent.hr_decision !== null && previousEvent.hr_decision !== "Ongoing" && !r.includes("pending") && !r.includes("may be");
    const isFailed = previousEvent.hr_decision !== null && previousEvent.hr_decision !== "Ongoing" && (r.includes("fail") || r.includes("rejected") || r.includes("reject"));
    const isOngoing = r.includes("ongoing") || r.includes("may be") || (!previousEvent.hr_decision && !isCompleted && !isFailed);
    return r.includes("pending") || isOngoing;
  })() : false, [previousEvent]);

  const resumeEvent = useMemo(() => events?.events.find(e => e.title === "Resume Screening"), [events]);

  const isResumePending = useMemo(() => resumeEvent ? (() => {
    const r = resumeEvent.hr_decision?.toLowerCase() || "";
    const isCompleted = resumeEvent.hr_decision !== null && resumeEvent.hr_decision !== "Ongoing" && !r.includes("pending") && !r.includes("may be");
    const isFailed = r === "failed" || r === "fail" || r === "rejected" || r === "reject";
    const isOngoing = r.includes("ongoing") || r.includes("may be") || (!resumeEvent.hr_decision && !isCompleted && !isFailed);
    return r.includes("pending") || isOngoing;
  })() : false, [resumeEvent]);

  useEffect(() => {
    onTranscriptDisableChange?.(
      isPolling ||
      currentStage === "Resume Screening" ||
      isPreviousStagePending ||
      isResumePending ||
      firstRejectedIndex !== -1
    );
  }, [isPolling, currentStage, isPreviousStagePending, isResumePending, firstRejectedIndex, onTranscriptDisableChange]);

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
        {/* <div className="w-full flex items-end justify-end px-4 py-2">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              className="rounded-xl border border-muted-foreground/10 px-5 font-semibold"
              onClick={() => setIsJobModalOpen(true)}
            >
              JD
            </Button>
            {currentStage !== "Resume Screening" && <TranscriptUpload
              stageId={stageId}
              className="w-1/2 sm:max-w-xs"
              job={job!}
              disabled={isPolling || currentStage === "Resume Screening" || isPreviousStagePending || isResumePending || firstRejectedIndex !== -1}
              onSuccess={() => {
                setIsPolling(true);
                fetchHistory();
              }}
            />}
          </div>
        </div> */}
      </div>
      <ScrollArea className="w-full whitespace-nowrap rounded-md border-0">
        <div className="flex w-max space-x-1 p-1">
          {events?.events.map((event, index) => {
            // @ts-expect-error - event_type might not be in all events
            const _isDecision = event.event_type === "decision";
            const resultLower = event.result?.toLowerCase() || "";

            const isCompleted = event.result !== null && event.result !== "Ongoing" && !resultLower.includes("pending");
            const isOngoing = resultLower.includes("ongoing") || (!event.result && !isCompleted);
            const isPending = resultLower.includes("pending") || isOngoing;
            const isSelected = event.title === selectedStage;
            const isAfterRejection = firstRejectedIndex !== -1 && index > (firstRejectedIndex ?? 0);
            const isActuallyActive = events?.current_stage ? event.title === events.current_stage : isOngoing;

            return (
              <React.Fragment key={index}>
                <Card
                  onClick={() => {
                    const targetStage = event.stage_id ? (event.title || "Resume Screening") : "Resume Screening";
                    const slug = slugify(targetStage);
                    navigate(`../${slug}`, {
                      relative: "path",
                      state: { job, candidate }
                    });
                    handleEventClick(event);
                  }}
                  className={cn(
                    "flex w-[250px] flex-col p-2.5 gap-1.5 shrink-0 border cursor-pointer hover:border-primary/50 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20 scale-[1.02]"
                      : isOngoing
                        ? "border-primary/40 bg-primary/5"
                        : "border-muted-foreground/10 bg-card hover:bg-muted/30",
                    isAfterRejection && "opacity-40 grayscale-[0.5]"
                  )}
                >
                  <div className="space-y-1 min-h-[38px]">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={cn(
                        "font-black text-xs text-wrap line-clamp-1",
                        isSelected ? "text-black font-bold dark:text-white" : isPending ? "text-foreground" : "text-foreground/90"
                      )} title={event.title}>
                        {event.title}
                      </h4>
                      {isActuallyActive && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-primary/30 font-black uppercase tracking-tighter whitespace-nowrap">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs font-bold uppercase tracking-tighter flex items-center gap-1",
                      isPending ? "text-foreground/70" : "text-muted-foreground"
                    )}>
                      {
                        event.event_date && <>
                          <Calendar className="h-2.5 w-2.5" />
                          <DateDisplay date={new Date(event.event_date)} className="text-xs" />
                        </>
                      }
                    </p>
                  </div>
                  <div className="pt-1.5 border-t border-muted-foreground/10 mt-auto">
                    <div className="flex flex-col gap-2 min-h-[54px]">
                      {event.ai_result &&
                        <div className="flex items-center justify-start gap-2">
                          <span className="text-xs font-bold uppercase tracking-tight text-muted-foreground">AI result:</span>
                          <CandidateStatusBadge status={event.ai_result?.replace("ed", "") || "N/A"} /> {event.score !== null && event.score !== undefined && (
                            <span className="text-xs font-bold ">
                              {event.score}{event.title !== "Resume Screening" ? "/5" : "%"}
                            </span>
                          )}
                        </div>}

                      {event.hr_decision &&
                        <div className="flex items-center justify-start gap-2">
                          <span className="text-xs font-bold uppercase tracking-tight text-muted-foreground">HR decision:</span>
                          <CandidateStatusBadge status={event.hr_decision?.replace("ed", "") || "N/A"} /> {event.hr_score !== null && event.hr_score !== undefined && (
                            <span className="text-xs font-bold ">
                              {event.hr_score}/5
                            </span>
                          )}
                        </div>}
                    </div>
                  </div>
                </Card>

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


