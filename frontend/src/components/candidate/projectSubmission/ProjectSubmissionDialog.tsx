import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { FileIcon, Loader2 } from "lucide-react";
import { ProjectSubmissionSchema, type ProjectSubmissionFormValues } from "@/schemas/candidate";
import {
  useEvaluateGithubMutation,
  useSubmitGithubMutation,
} from "@/hooks/mutations/candidates/useCandidateStages";
import { extractErrorMessage } from "@/utils/error";
import type { Job } from "@/types/job";
import { CandidateAssignPaperButton } from "@/components/shared/candidate/CandidateAssignPaperButton";
import { slugify } from "@/utils/slug";
import { useResolvedJobAndCandidate } from "@/hooks/queries/candidates";
import { Label } from "@/components/ui/label";
import { useCandidateTestPaper } from "@/hooks/queries/taskPapers/useTaskPaperQueries";

interface ProjectSubmissionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  candidateId?: string;
  stageId?: string;
  job: Job | null;
  onSuccess?: () => void;
}
export type TaskOption = "existing" | "new";
export function ProjectSubmissionDialog({
  isOpen,
  onOpenChange,
  candidateName,
  candidateId,
  stageId,
  onSuccess,
  job,
}: ProjectSubmissionDialogProps) {

  const { mutateAsync: evaluateGithub, isPending: isEvaluating } = useEvaluateGithubMutation();
  const { mutateAsync: submitGithub, isPending: isSubmitting } = useSubmitGithubMutation();

  const [evaluateImmediately, setEvaluateImmediately] = useState(true);

  // Fetch candidate's assigned task paper
  const jobSlug = slugify(job?.title);
  const { candidate: resolvedCandidate } = useResolvedJobAndCandidate({ jobSlug: jobSlug, candidateNameSlug: candidateName, stateJob: job, stateCandidateId: candidateId });

  const currentStage = resolvedCandidate?.pipeline?.find(
    (s) => s.stage_id === stageId || (s as any).id === stageId || s.job_stage_id === stageId
  );
  const isAlreadySubmitted = currentStage?.status === "submitted" || currentStage?.status === "processing";

  const form = useForm<ProjectSubmissionFormValues>({
    resolver: zodResolver(ProjectSubmissionSchema),
    defaultValues: {
      repoUrl: "",
      pdfFile: undefined,
    },
  });

  useEffect(() => {
    if (resolvedCandidate?.task_file_path) {
      form.setValue("repoUrl", resolvedCandidate.task_file_path);
    }
  }, [resolvedCandidate?.task_file_path, form]);

  const onSubmit = async (data: ProjectSubmissionFormValues) => {
    if (!candidateId) {
      toast.error("Candidate ID is missing");
      return;
    }
    if (!stageId) {
      toast.error("Stage ID is missing");
      return;
    }

    try {
      if (evaluateImmediately) {
        const response = await evaluateGithub({ stageId, githubUrl: data.repoUrl });
        toast.success(response.message || "GitHub repository evaluation triggered successfully!");
      } else {
        const response = await submitGithub({ stageId, githubUrl: data.repoUrl });
        toast.success(response.message || "GitHub repository successfully submitted.");
      }
      form.reset();
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMsg = extractErrorMessage(error);
      toast.error(errorMsg || "Failed to submit details. Please try again.");
    }
  };
  const { data: assignedPaper } = useCandidateTestPaper(candidateId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-175 h-[93vh] flex flex-col p-0 bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl gap-2">
        <DialogHeader className="p-3 pb-2 border-b border-muted-foreground/10">
          <DialogTitle className="text-xl font-bold tracking-tight">
            Technical Practical Round Submission
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Provide the required assessment resources for <span className="font-semibold text-foreground capitalize">{candidateName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 p-2 overflow-y-auto space-y-2 min-h-0">
              <FormField
                control={form.control}
                name="repoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">GitHub / GitLab URL</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://github.com/username/repository"
                        className="h-11 rounded-2xl border-muted-foreground/20 focus:border-primary/30 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-start gap-2 px-1 py-1.5">
                <Checkbox
                  id="evaluateImmediately"
                  checked={evaluateImmediately}
                  onCheckedChange={(checked) => setEvaluateImmediately(!!checked)}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="evaluateImmediately"
                    className="text-sm font-semibold cursor-pointer"
                  >
                    Evaluate repository immediately using AI
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {evaluateImmediately
                      ? "Submit repository for AI evaluation immediately"
                      : "Saves the repository URL without running evaluation. The AI will evaluate it automatically in 24 hours."}
                  </p>
                </div>
              </div>

              {isAlreadySubmitted && (
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs font-semibold">Repository Already Submitted</p>
                  <p className="text-xs text-muted-foreground leading-normal">
                    This candidate stage is currently in the <span className="font-semibold text-amber-600 dark:text-amber-400">"{currentStage?.status}"</span> status.
                    Checking the box above will re-trigger the AI evaluation task immediately.
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="pdfFile"
                render={() => (
                  <FormItem className="space-y-1 pt-1">
                    <FormLabel className="text-base font-semibold">Project Requirement Document</FormLabel>

                    <FormControl>
                      <div className="flex items-center gap-3 w-full bg-primary/5 border border-primary/10 rounded-xl p-2 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            Assigned Question Paper
                          </p>
                          {/*<p className="text-xs text-muted-foreground">
                            Click to view the candidate's assigned question Paper.
                          </p>*/}
                        </div>
                        {/* <CandidateAssignPaperButton candidate={resolvedCandidate} job={job} jobSlug={jobSlug}
                          variant="ghost"
                          size="sm"
                          className="rounded-lg gap-1.5 text-xs"
                          iconClassName="h-3.5 w-3.5"
                        /> */}
                        {assignedPaper && (
                          <CandidateAssignPaperButton candidate={resolvedCandidate} job={job} jobSlug={jobSlug} variant="ghost"
                            size="icon-sm"
                            className="rounded-lg gap-1.5 text-xs" iconClassName="h-3.5 w-3.5" disabled={false} />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="p-1 border-t border-muted-foreground/10 bg-muted/20 gap-2 flex items-center justify-end rounded-2xl">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={isEvaluating || isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-6 font-semibold"
                disabled={isEvaluating || isSubmitting || !form.formState.isValid}
              >
                {isEvaluating || isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEvaluating ? "Evaluating..." : "Submitting..."}
                  </span>
                ) : evaluateImmediately ? (
                  isAlreadySubmitted ? "Start Evaluation Now" : "Evaluate Now"
                ) : (
                  "Submit & Schedule"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
