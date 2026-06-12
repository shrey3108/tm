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
import { ExternalLink, FileIcon, Loader2 } from "lucide-react";
import { ProjectSubmissionSchema, type ProjectSubmissionFormValues } from "@/schemas/candidate";
import {
  useEvaluateGithubMutation,
} from "@/hooks/mutations/candidates/useCandidateStages";
import { extractErrorMessage } from "@/utils/error";
import type { Job } from "@/types/job";
import { useDownloadCandidateAssignedTaskFile } from "@/hooks/queries/taskPapers/useTaskPaperQueries";

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
}: ProjectSubmissionDialogProps) {
  const { mutateAsync: evaluateGithub, isPending: isEvaluating } = useEvaluateGithubMutation();

  // Fetch candidate's assigned task paper
  const { data: candidateAssignedTaskBlob } = useDownloadCandidateAssignedTaskFile(candidateId);

  const handleViewCandidateAssignedTask = () => {
    if (!candidateAssignedTaskBlob) return;
    const url = URL.createObjectURL(candidateAssignedTaskBlob);
    window.open(url, "_blank");
  };

  const form = useForm<ProjectSubmissionFormValues>({
    resolver: zodResolver(ProjectSubmissionSchema),
    defaultValues: {
      repoUrl: "",
      pdfFile: undefined,
    },
  });

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


      const response = await evaluateGithub({ stageId, githubUrl: data.repoUrl });
      toast.success(response.message || "GitHub repository evaluation triggered successfully!");
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[700px] h-[93vh] flex flex-col p-0 bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl">
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

              <FormField
                control={form.control}
                name="pdfFile"
                render={() => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base font-semibold">Project Requirement Document</FormLabel>

                    <FormControl>
                      <div className="flex items-center gap-3 w-full bg-primary/5 border border-primary/10 rounded-xl p-2 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            Assigned Task File
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Click to view the candidate's assigned task paper.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg gap-1.5 text-xs"
                          onClick={handleViewCandidateAssignedTask}
                          disabled={!candidateAssignedTaskBlob}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View
                        </Button>
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
                disabled={isEvaluating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-6 font-semibold"
                disabled={isEvaluating || !form.formState.isValid}
              >
                {isEvaluating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit details"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
