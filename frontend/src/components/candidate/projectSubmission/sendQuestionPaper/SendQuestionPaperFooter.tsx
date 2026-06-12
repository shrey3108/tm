import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2, Mail, SendIcon } from "lucide-react";

interface SendQuestionPaperFooterProps {
  onCancel: () => void;
  hasAssignedPaper: boolean;
  mode: "predefined" | "random" | "custom";
  selectedPaperId: string;
  customQuestions: string[];
  customProjectTask: string;
  isAssignPending: boolean;
  isSendEmailPending: boolean;
  onAssign: () => void;
  onSendEmail: () => void;
}

export function SendQuestionPaperFooter({
  onCancel,
  hasAssignedPaper,
  mode,
  selectedPaperId,
  customQuestions,
  customProjectTask,
  isAssignPending,
  isSendEmailPending,
  onAssign,
  onSendEmail,
}: SendQuestionPaperFooterProps) {

  const isAssignDisabled =
    isAssignPending ||
    (mode === "predefined" && !selectedPaperId) ||
    (mode === "custom" &&
      (customQuestions.length !== 5 || !customProjectTask.trim()));

  return (
    <DialogFooter className="p-1 border-t border-muted-foreground/10 bg-muted/20 shrink-0 gap-2 flex items-center justify-end flex-row">
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
        <Button
          type="button"
          className="rounded-xl px-3 font-semibold gap-1.5"
          onClick={onSendEmail}
          disabled={isAssignDisabled}

        >
          {isSendEmailPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending email...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Send to Candidate via Email
            </>
          )}
        </Button>
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
              <SendIcon className="h-4 w-4" />
              Assign Paper
            </>
          )}
        </Button>
      )}
    </DialogFooter>
  );
}
