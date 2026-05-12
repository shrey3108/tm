import { useState } from "react";
import { Field } from "@/components/ui/field";
import { toast } from "sonner";
import { extractErrorMessage } from "@/utils/error";
import { transcriptService } from "@/apis/transcript";
import { Input } from "@/components/ui/input";
import type { Job } from "@/types/job";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { TranscriptFilePathSchema, type TranscriptFilePathFormValues } from "@/schemas/file";

interface TranscriptUploadProps {
  /** UUID of the candidate stage to upload transcript to */
  stageId?: string;
  /** Callback on successful upload */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Button label text */
  label?: string;
  /** Associated job */
  job: Job;
  /** Whether the upload is disabled */
  disabled?: boolean;
}

/**
 * A dedicated component for uploading transcripts to a specific job stage.
 * Now handles file path entry with validation using react-hook-form instead of direct file upload.
 */
export function TranscriptUpload({
  stageId,
  onSuccess,
  className,
  // label = "Transcribe",
  disabled,
}: TranscriptUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const form = useForm<TranscriptFilePathFormValues>({
    resolver: zodResolver(TranscriptFilePathSchema),
    defaultValues: {
      filePath: "",
    },
    mode: "onChange",
  });

  /**
   * Handles the transcript path submission.
   */
  const onSubmit = async (values: TranscriptFilePathFormValues) => {
    if (!stageId) {
      toast.error("Process stage ID is missing");
      return;
    }

    setIsUploading(true);
    try {
      const response = await transcriptService.uploadTranscript(stageId, values.filePath);
      toast.success(response.message || "Transcript path submitted successfully!");
      setOpen(false);
      form.reset();
      if (onSuccess) onSuccess();
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to submit transcript path");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Field className={cn("w-full mr-5", className)}>
      <PermissionGuard permissions={PERMISSIONS.CANDIDATES_ACCESS} hideWhenDenied>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            form.reset();
          }
        }}>
          <DialogTrigger>
            <Button variant="outline" className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center" disabled={disabled} size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Upload Transcript
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Transcript</DialogTitle>
              <DialogDescription>
                Enter the full path of the transcript file to upload.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <FormField
                    control={form.control}
                    name="filePath"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="C:\path\to\transcript.txt or /path/to/transcript.txt"
                            disabled={isUploading}
                            className={cn(form.formState.errors.filePath ? "border-destructive" : "")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={isUploading || !form.formState.isValid}
                  >
                    {isUploading ? "Uploading..." : "Submit Path"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PermissionGuard>
    </Field>
  );
}
