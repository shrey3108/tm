import { useMemo } from "react";
import type { HiringTimelineResponse } from "@/types/candidate";
import { isFailed, isStageWaiting, isPassedOrRejected } from "./timelineStatusUtils";



interface UseTimelineStatusParams {
  events: HiringTimelineResponse | undefined;
  stageId: string | undefined;
  currentStage: string;
}

interface TimelineStatusResult {
  /** Index of the first event whose `hr_decision` is fail/rejected (or -1). */
  firstRejectedIndex: number;
  /** Index of the event matching the current stage / stageId (or -1). */
  activeEventIndex: number;
  /** Whether the stage *before* the active one is still pending / ongoing. */
  isPreviousStagePending: boolean;
  /** Whether the active stage already has a pass or reject decision. */
  isCurrentStagePassedOrRejected: boolean;
  /** Whether the "Resume Screening" event is still pending / ongoing. */
  isResumePending: boolean;
}



/**
 * Derives all timeline-status booleans from the raw events list.
 *
 */
export function useTimelineStatus({
  events,
  stageId,
  currentStage,
}: UseTimelineStatusParams): TimelineStatusResult {


  const firstRejectedIndex = useMemo(
    () => events?.events.findIndex((e) => isFailed(e.hr_decision)) ?? -1,
    [events],
  );

  const activeEventIndex = useMemo(
    () =>
      events?.events.findIndex(
        (e) => (stageId && e.stage_id === stageId) || e.title === currentStage,
      ) ?? -1,
    [events, stageId, currentStage],
  );

  const isPreviousStagePending = useMemo(() => {
    if (activeEventIndex <= 0) return false;
    const prev = events?.events[activeEventIndex - 1];
    return prev ? isStageWaiting(prev.hr_decision) : false;
  }, [events, activeEventIndex]);

  const isCurrentStagePassedOrRejected = useMemo(() => {
    if (activeEventIndex < 0) return false;
    const current = events?.events[activeEventIndex];
    return isPassedOrRejected(current?.hr_decision);
  }, [events, activeEventIndex]);

  const isResumePending = useMemo(() => {
    const resume = events?.events.find((e) => e.title === "Resume Screening");
    return resume ? isStageWaiting(resume.hr_decision) : false;
  }, [events]);

  return {
    firstRejectedIndex,
    activeEventIndex,
    isPreviousStagePending,
    isCurrentStagePassedOrRejected,
    isResumePending,
  };
}
