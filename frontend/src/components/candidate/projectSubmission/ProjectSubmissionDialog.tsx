import { useState, useRef, useEffect } from "react";
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
import { FileIcon, Loader2, Upload, X } from "lucide-react";
import { ProjectSubmissionSchema, type ProjectSubmissionFormValues } from "@/schemas/candidate";
import {
  useUploadCandidateTaskMutation,
  useEvaluateGithubMutation,
} from "@/hooks/mutations/candidates/useCandidateStages";
import { extractErrorMessage } from "@/utils/error";
import { useJobTask } from "@/hooks/queries/jobs";
import type { Job } from "@/types/job";
import { ALLOWED_TASK_FILE_TYPES } from "@/constants";
import { ProjectTaskOptions } from "./ProjectTaskOptions";

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
  job,
  onSuccess,
}: ProjectSubmissionDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { mutateAsync: uploadCandidateTask, isPending: isUploading } = useUploadCandidateTaskMutation();
  const { mutateAsync: evaluateGithub, isPending: isEvaluating } = useEvaluateGithubMutation();
  const { data: jobTask } = useJobTask(job?.id);
  const [taskOption, setTaskOption] = useState<TaskOption>("new");

  useEffect(() => {
    if (isOpen) {
      if (jobTask?.task_file_path) {
        setTaskOption("existing");
      } else {
        setTaskOption("new");
      }
    }
  }, [isOpen, jobTask?.task_file_path]);

  const form = useForm<ProjectSubmissionFormValues>({
    resolver: zodResolver(ProjectSubmissionSchema),
    defaultValues: {
      repoUrl: "",
      pdfFile: undefined,
    },
  });

  const selectedFile = form.watch("pdfFile") as File | undefined;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("pdfFile", file, { shouldValidate: true });
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    form.setValue("pdfFile", undefined, { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
      if (taskOption === "new" && data.pdfFile) {
        toast.info("Uploading project requirement file...");
        await uploadCandidateTask({ candidateId, file: data.pdfFile });
        toast.success("Task file uploaded successfully")
      }
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
                    <FormLabel className="text-sm font-semibold">GitHub / GitLab URL</FormLabel>
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
                    <FormLabel className="text-sm font-semibold">Project Requirement Document</FormLabel>

                    {jobTask?.task_file_path && (
                      <ProjectTaskOptions
                        form={form}
                        taskOption={taskOption}
                        setTaskOption={setTaskOption}
                        fileInputRef={fileInputRef}
                      />
                    )}

                    <FormControl>
                      {taskOption === "existing" && jobTask?.task_file_path ? (
                        <div className="flex items-center gap-3 w-full bg-primary/5 border border-primary/10 rounded-xl p-2 animate-in fade-in slide-in-from-top-2">
                          <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                            <FileIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Thier is already task file.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 dark:hover:border-primary/40 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/5 hover:bg-muted/10 transition-colors relative"
                        >
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            accept={ALLOWED_TASK_FILE_TYPES.join(",")}
                          />

                          {selectedFile ? (
                            <div className="flex items-center gap-3 w-full bg-background border border-muted-foreground/15 rounded-xl p-3 animate-in fade-in zoom-in-95">
                              <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
                                <FileIcon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                                {/* <p className="text-xs text-muted-foreground">
                                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                </p> */}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-lg text-muted-foreground hover:text-foreground"
                                onClick={handleClearFile}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Upload className="h-5 w-5" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium">Click to upload</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {ALLOWED_TASK_FILE_TYPES.join(" ")} files only (Max 5MB)
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="p-6 border-t border-muted-foreground/10 bg-muted/20 gap-2 flex items-center justify-end rounded-2xl">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={isUploading || isEvaluating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-6 font-semibold"
                disabled={isUploading || isEvaluating || (taskOption === "new" && !selectedFile) || !form.formState.isValid}
              >
                {isUploading || isEvaluating ? (
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
