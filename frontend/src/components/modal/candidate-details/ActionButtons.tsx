import { Button } from "@/components/ui/button";
import { RESUME_SCREENING_RESULT } from "@/constants";
import { cn } from "@/lib/utils";
import type { CandidateDecisionFormValues } from "@/schemas/candidate";
import type { AssociateResultsResponse } from "@/types/associateReview";
import { Clock } from "lucide-react";

/**
 * Props for {@link ActionButtons}.
 */
interface ActionButtonsProps {
  onAction: (type: CandidateDecisionFormValues['decision']) => void;
  showMaybeButton: boolean;
  className?: string;
  disabled?: boolean;
  associateResults?: AssociateResultsResponse;
}

/**
 * Footer action bar with Approve, Maybe, and Reject buttons for a screening decision.
 * The "Maybe" button is conditionally rendered based on the candidate's current state.
 */
export function ActionButtons({
  onAction,
  showMaybeButton,
  className,
  disabled,
  associateResults,
}: ActionButtonsProps) {
  return (
    <>
      <div className={cn("sticky bottom-0 z-10 border-t border-muted-foreground/10 bg-card/95 p-2 backdrop-blur supports-backdrop-filter:bg-card/80 flex flex-col gap-2 sm:flex-wrap sm:items-center sm:justify-center", className)}>
        {disabled && associateResults && associateResults.total_associates > 0 && (
          <div className="w-full max-w-md mx-auto text-xs text-amber-600 dark:text-amber-400 font-medium text-center bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl py-2 px-3 shadow-sm flex flex-col items-center justify-center gap-1">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>
                Waiting for all assigned associates to submit their reviews ({associateResults.submitted_count}/{associateResults.total_associates})
              </span>
            </div>
            {associateResults.reviews && associateResults.reviews.some(r => !r.submitted_at || r.status === "sent") && (
              <div className="text-xs text-amber-600/80 dark:text-amber-400/80 ">
                Pending: {associateResults.reviews
                  .filter(r => !r.submitted_at || r.status === "sent")
                  .map(r => r.associate_name)
                  .join(", ")}
              </div>
            )}
          </div>
        )}
        {/* {!associateResults && (
          <div className="w-full max-w-md mx-auto text-xs text-amber-600 dark:text-amber-400 font-medium text-center bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl py-2 px-3 shadow-sm flex flex-col items-center justify-center gap-1">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>
                No associates assigned
              </span>
            </div>
          </div>
        )} */}
        <p className="text-md font-medium text-center">HR Decision</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
          <Button
            onClick={() => onAction("pass")}
            variant="outline"
            size={"sm"}
            disabled={disabled}
            className="w-full rounded-xl px-8 shadow-md uppercase font-medium sm:w-auto text-black bg-green-300 dark:bg-green-300 hover:text-black hover:bg-green-400 hover:border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {RESUME_SCREENING_RESULT.PASS}
          </Button>
          {showMaybeButton && (
            <Button
              variant="outline"
              size={"sm"}
              disabled={disabled}
              onClick={() => onAction("maybe")}
              className="w-full rounded-xl px-8 shadow-sm uppercase font-medium sm:w-auto border-primary dark:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Maybe
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onAction("fail")}
            size={"sm"}
            disabled={disabled}
            className="w-full rounded-xl px-8 shadow-md uppercase font-medium sm:w-auto text-black bg-red-300 dark:bg-red-300 hover:text-black hover:bg-red-400 hover:border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {RESUME_SCREENING_RESULT.FAIL}
          </Button>
        </div>
      </div>
    </>
  );
}

