import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2, Mail } from "lucide-react";

import type { AssignmentMode } from "./ModeTabBar";

interface SendQuestionPaperFooterProps {
  onCancel: () => void;
  hasAssignedPaper: boolean;
  mode: AssignmentMode;
  selectedPaperId: string;
  isAssignPending: boolean;
  isSendEmailPending: boolean;
  onAssign: () => void;
  onSendEmail: () => void;
  isEmailAlreadySent?: boolean;
  canSendEmail?: boolean;
  totalQuestions: number;
  totalMcqs: number;
  totalTasks: number;
}

export function SendQuestionPaperFooter({
  onCancel,
  hasAssignedPaper,
  mode,
  // selectedPaperId,
  isAssignPending,
  isSendEmailPending,
  onAssign,
  onSendEmail,
  isEmailAlreadySent,
  canSendEmail = true,
  totalQuestions,
  totalMcqs,
  totalTasks,
  hasExtraItems = false,
}: SendQuestionPaperFooterProps & { hasExtraItems?: boolean }) {

  const isExtraMode = mode === "random_extra" || mode === "custom_extra" || mode === "full_mix";

  const isAssignDisabled =
    isAssignPending ||
    (isExtraMode && !hasExtraItems) ||
    (mode === "random_extra" && totalQuestions <= 0) ||
    (mode !== "random_extra" && (totalQuestions <= 0 || totalTasks <= 0));

  return (
    <DialogFooter className="p-3 border-t border-muted-foreground/10 bg-muted/20 shrink-0 gap-3 flex items-center justify-between flex-row">
      {!hasAssignedPaper && (
        <div className="text-xs font-semibold text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/40 shrink-0">
          Total: <span className="text-foreground">{totalQuestions}</span> {totalQuestions === 1 ? "Question" : "Questions"} · <span className="text-foreground">{totalMcqs}</span> {totalMcqs === 1 ? "MCQ" : "MCQs"} · <span className="text-foreground">{totalTasks}</span> {totalTasks === 1 ? "Task" : "Tasks"}
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onCancel}
          disabled={isAssignPending || isSendEmailPending}
        >
          {hasAssignedPaper ? "Close" : "Cancel"}
        </Button>

        {hasAssignedPaper ? (
          canSendEmail ? (
            <Button
              type="button"
              className="rounded-xl px-3 font-semibold gap-1.5"
              onClick={onSendEmail}
              disabled={isAssignPending || isSendEmailPending}
            >
              {isSendEmailPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending email...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {isEmailAlreadySent ? "Re-Send" : "Send"} to Candidate via Email
                </>
              )}
            </Button>
          ) : null
        ) : (
          <Button
            type="button"
            className="rounded-xl px-3 font-semibold gap-1.5"
            onClick={onAssign}
            disabled={isAssignDisabled}
          >
            {isAssignPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                Assign Paper
              </>
            )}
          </Button>
        )}
      </div>
    </DialogFooter>
  );
}

