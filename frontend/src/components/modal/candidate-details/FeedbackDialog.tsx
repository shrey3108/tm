import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Star } from "lucide-react";
import { Controller } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import type { CandidateDecisionFormValues } from "@/schemas/candidate";
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
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setHoverValue(null);
    }
  }, [isOpen]);

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
                <span className="text-xs text-muted-foreground">Rating</span>
                <Controller
                  control={form.control}
                  name="score"
                  render={({ field }) => {
                    const displayValue = hoverValue !== null ? hoverValue : (field.value ?? 0);
                    return (
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex items-center gap-0.5"
                          onMouseLeave={() => setHoverValue(null)}
                        >
                          {Array.from({ length: 5 }).map((_, index) => {
                            const starValue = index + 1;
                            let fillType: "full" | "half" | "empty" = "empty";

                            if (displayValue >= starValue) {
                              fillType = "full";
                            } else if (displayValue === starValue - 0.5) {
                              fillType = "half";
                            }

                            return (
                              <div
                                key={index}
                                className="relative w-6 h-6 select-none transition-transform active:scale-95 duration-100"
                              >
                                {/* Left half hit zone */}
                                <div
                                  className="absolute top-0 left-0 w-1/2 h-full cursor-pointer z-10"
                                  onMouseEnter={() => setHoverValue(Math.max(1, starValue - 0.5))}
                                  onClick={() => field.onChange(Math.max(1, starValue - 0.5))}
                                />
                                {/* Right half hit zone */}
                                <div
                                  className="absolute top-0 right-0 w-1/2 h-full cursor-pointer z-10"
                                  onMouseEnter={() => setHoverValue(starValue)}
                                  onClick={() => field.onChange(starValue)}
                                />

                                {/* Background empty star */}
                                <Star className="w-6 h-6 text-muted-foreground/30 fill-none" />

                                {/* Full star overlay */}
                                {fillType === "full" && (
                                  <Star className="absolute top-0 left-0 w-6 h-6 text-[#E17100]  fill-[#FFB900]" />
                                )}

                                {/* Half star overlay */}
                                {fillType === "half" && (
                                  <Star
                                    className="absolute top-0 left-0 w-6 h-6 text-[#E17100]  fill-[#FFB900]"
                                    style={{ clipPath: "inset(0 50% 0 0)" }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#F9EBE1] text-[#E17100] text-xs font-medium min-w-[40px] text-center">
                          {displayValue.toFixed(1)} / 5.0
                        </span>
                      </div>
                    );
                  }}
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
              <>
                {errors.note && <p className="text-xs text-red-500">
                  {errors.note.message}
                </p>}
                {errors.score && <p className="text-xs text-red-500">
                  {errors.score.message}
                </p>}
              </>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost"
            className="rounded-xl"
            onClick={() => {
              onOpenChange(false)
              form.reset({ note: "", score: 0 })
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
