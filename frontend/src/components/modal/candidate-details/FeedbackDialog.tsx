import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";
import { Controller } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import type { CandidateDecisionFormValues } from "@/schemas/candidate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HR_DECISION_OPTIONS } from "@/constants";

/**
 * Props for {@link FeedbackDialog}.
 */
interface FeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CandidateDecisionFormValues>;
  onSubmit: (data: CandidateDecisionFormValues) => void;
  candidateName: string;
  isSubmitting: boolean;
}

/**
 * Confirmation dialog for submitting a screening decision (pass / fail / maybe)
 * with a required note. The dialog title and button variant adapt to the selected
 * decision type. Integrates with React Hook Form + Zod validation.
 */
export function FeedbackDialog({
  isOpen,
  onOpenChange,
  form,
  onSubmit,
  candidateName,
  isSubmitting,
}: FeedbackDialogProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = form;

  const feedbackType = watch("decision");
  const scoreRange = new Array(5).fill(0).map((_, i) => i + 1)
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center 
                ${feedbackType === "pass" ? "bg-green-500/10 text-green-600" :
                  feedbackType === "fail" ? "bg-red-500/10 text-red-600"
                    : "bg-amber-500/10 text-amber-600"
                }`}
            >
              <MessageSquare className="h-5 w-5" />
            </div>
            {feedbackType === "pass" ? HR_DECISION_OPTIONS.PASS :
              feedbackType === "fail" ? HR_DECISION_OPTIONS.FAIL :
                HR_DECISION_OPTIONS.MAY_BE}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-sm text-muted-foreground">
                  Reason for{" "}
                  <span className="font-medium">
                    {feedbackType === "pass" ? HR_DECISION_OPTIONS.PASS :
                      feedbackType === "fail" ? HR_DECISION_OPTIONS.FAIL :
                        HR_DECISION_OPTIONS.MAY_BE}
                  </span>
                </label>

              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground ">Rating</span>
                <Controller
                  control={form.control}
                  name="score"
                  render={({ field }) => (
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(val) => field.onChange(Number(val))}
                    >
                      <SelectTrigger className="w-[100px] rounded-xl bg-background border-muted-foreground/20 text-sm font-semibold" size="sm">
                        <SelectValue placeholder="Rating" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-muted-foreground/10 bg-popover/90 backdrop-blur-xl min-w-fit" >
                        {
                          scoreRange.map((item) => (<SelectItem value={item.toString()}>{item} </SelectItem>))
                        }
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <Textarea
              placeholder={`Enter reason for ${feedbackType === "pass" ? "passing" :
                feedbackType === "fail" ? "failing" :
                  "marking as maybe"
                } ${candidateName}...`}
              className={`min-h-[120px] rounded-2xl resize-none border-muted-foreground/20 focus:border-primary/30 transition-colors ${errors.note ? "border-red-500 focus:border-red-500" : ""
                }`}
              {...register("note")}
            />
            {errors && (
              <p className="text-xs  text-red-500">
                {errors.note && errors.note.message}
                {errors.score && errors.score.message}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost"
            className="rounded-xl"
            onClick={() => {
              onOpenChange(false)
              form.reset({ note: "", score: 5 })
            }}
          >
            Cancel
          </Button>
          <Button
            variant={
              feedbackType === "pass" ? "default" :
                feedbackType === "fail" ? "destructive" :
                  "secondary"
            }
            className="rounded-xl px-8"
            disabled={isSubmitting || isFormSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting || isFormSubmitting ? "Submitting..." : `Confirm ${feedbackType === "pass" ? HR_DECISION_OPTIONS.PASS :
              feedbackType === "fail" ? HR_DECISION_OPTIONS.FAIL : HR_DECISION_OPTIONS.MAY_BE}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
