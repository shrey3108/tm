import { useState, useRef } from "react";
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
  FormDescription,
} from "@/components/ui/form";
import { FileIcon, Loader2, Upload, X } from "lucide-react";
import { ProjectSubmissionSchema, type ProjectSubmissionFormValues } from "@/schemas/candidate";



interface ProjectSubmissionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
}

export function ProjectSubmissionDialog({ isOpen, onOpenChange, candidateName }: ProjectSubmissionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
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

  const onSubmit = async (_data: ProjectSubmissionFormValues) => {
    setIsSubmitting(true);
    try {
      // TEMP Mock submit action
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success("Technical Practical Round details submitted successfully!");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to submit details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Technical Practical Round Submission
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Provide the required assessment resources for <span className="font-semibold text-foreground capitalize">{candidateName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
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
                  <FormDescription className="text-xs text-muted-foreground">
                    Provide the public repository link for the practical assignment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pdfFile"
              render={() => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Project Requirement Document</FormLabel>
                  <FormControl>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 dark:hover:border-primary/40 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/5 hover:bg-muted/10 transition-colors relative"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />

                      {selectedFile ? (
                        <div className="flex items-center gap-3 w-full bg-background border border-muted-foreground/15 rounded-xl p-3 animate-in fade-in zoom-in-95">
                          <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
                            <FileIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
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
                            <p className="text-sm font-medium">Click to upload or drag & drop</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              PDF files only (Max 5MB)
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-6 font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
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
