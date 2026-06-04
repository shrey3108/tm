/**
 * Pure utility functions for determining timeline event statuses.
 *
 */

const FAIL_KEYWORDS = ["fail", "failed", "rejected", "reject"] as const;
const PENDING_KEYWORDS = ["pending"] as const;
const ONGOING_KEYWORDS = ["ongoing", "may be", "May Be", "May be"] as const;


/** Returns `true` when the decision indicates failure or rejection. */
export function isFailed(decision: string | null | undefined): boolean {
  const d = decision?.toLowerCase() ?? "";
  return FAIL_KEYWORDS.some((k) => d.includes(k));
}

/** Returns `true` when the decision explicitly contains "pending". */
export function isPendingDecision(decision: string | null | undefined): boolean {
  const d = decision?.toLowerCase() ?? "";
  return PENDING_KEYWORDS.some((k) => d.includes(k));
}

/** Returns `true` when the decision indicates an ongoing / uncertain state. */
export function isOngoing(decision: string | null | undefined): boolean {
  const d = decision?.toLowerCase() ?? "";
  return (
    ONGOING_KEYWORDS.some((k) => d.includes(k)) ||
    (!decision && !isCompleted(decision))
  );
}

/**
 * Returns `true` when the decision is present, not "Ongoing",
 * and not pending / uncertain.
 */
export function isCompleted(decision: string | null | undefined): boolean {
  if (decision === null || decision === undefined) return false;
  const d = decision.toLowerCase();
  return (
    decision !== "Ongoing" &&
    !PENDING_KEYWORDS.some((k) => d.includes(k)) &&
    !ONGOING_KEYWORDS.some((k) => d.includes(k))
  );
}

/**
 * Returns `true` when the decision is either pending or ongoing —
 * i.e. the stage has *not* reached a definitive pass/fail conclusion.
 */
export function isStageWaiting(decision: string | null | undefined): boolean {
  return isPendingDecision(decision) || isOngoing(decision);
}



/** Whether an event's *result* marks it as completed (not ongoing / pending). */
export function isEventCompleted(result: string | null | undefined): boolean {
  if (result === null || result === undefined) return false;
  const r = result.toLowerCase();
  return result !== "Ongoing" && !r.includes("pending");
}

/** Whether an event's *result* marks it as still in progress. */
export function isEventOngoing(result: string | null | undefined): boolean {
  const r = result?.toLowerCase() ?? "";
  return r.includes("ongoing") || (!result && !isEventCompleted(result));
}

/** Whether an event's *result* indicates a pending / ongoing state. */
export function isEventPending(result: string | null | undefined): boolean {
  const r = result?.toLowerCase() ?? "";
  return r.includes("pending") || isEventOngoing(result);
}

/** Whether an HR decision indicates pass or rejection (a decisive outcome). */
export function isPassedOrRejected(decision: string | null | undefined): boolean {
  const d = decision?.toLowerCase() ?? "";
  return d.includes("pass") || isFailed(decision);
}
