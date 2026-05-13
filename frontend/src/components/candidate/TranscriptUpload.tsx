import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { toast } from "sonner";
import { extractErrorMessage } from "@/utils/error";
import { transcriptService } from "@/apis/transcript";
// import { Input } from "@/components/ui/input";
import type { Job } from "@/types/job";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Loader2, PenSquareIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group"

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { TranscriptFileNameSchema, TranscriptFilePathSchema, type TranscriptFileNameFormValues } from "@/schemas/file";

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
  const [isLoading, setIsLoading] = useState(false);
  const [defaultPath, setDefaultPath] = useState("");
  const form = useForm<TranscriptFileNameFormValues>({
    resolver: zodResolver(TranscriptFileNameSchema),
    defaultValues: {
      filePath: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (open) {
      const fetchDefaultPath = async () => {
        setIsLoading(true)
        try {
          const response = await transcriptService.getDefaultTranscriptPath()
          // form.reset({ filePath: response.default_path || "" })
          setDefaultPath(response.default_path || "")
        } catch (error: any) {
          toast.error("Failed to fetch default path")
        } finally {
          setIsLoading(false)
        }
      }
      fetchDefaultPath()
    } else {
      form.reset()
    }
  }, [open, form])

  /**
   * Handles the transcript path submission.
   */
  const onSubmit = async (values: TranscriptFileNameFormValues) => {
    if (!stageId) {
      toast.error("Process stage ID is missing");
      return;
    }

    setIsUploading(true);
    try {
      // Construct the full path
      const separator = defaultPath.includes('/') ? '/' : '\\';
      const cleanFilePath = values.filePath.startsWith(separator) ? values.filePath.substring(1) : values.filePath;
      const fullPath = defaultPath
        ? (defaultPath.endsWith(separator)
          ? `${defaultPath}${cleanFilePath}`
          : `${defaultPath}${separator}${cleanFilePath}`)
        : values.filePath;

      // Final validation of the constructed full path
      const validationResult = TranscriptFilePathSchema.safeParse({ filePath: fullPath });
      if (!validationResult.success) {
        form.setError("filePath", {
          type: "manual",
          message: validationResult.error.issues.map(i => i.message).join(" ")
        });
        setIsUploading(false);
        return;
      }

      const response = await transcriptService.uploadTranscript(stageId, fullPath);
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
              <PenSquareIcon className="mr-2 w-4 h-4" />
              Transcript
            </Button>
          </DialogTrigger>
          <DialogContent>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Transcript Path</DialogTitle>
                  <DialogDescription>
                    {defaultPath
                      ? "Enter the filename and extension of the transcript file."
                      : "Enter the full path of the transcript file to upload."}
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
                              {/* <Input
                                placeholder="C:\path\to\transcript.txt or /path/to/transcript.txt"
                                disabled={isUploading}
                                className={cn(form.formState.errors.filePath ? "border-destructive" : "")}
                                {...field}
                              /> */}
                              <InputGroup>
                                <InputGroupInput placeholder={defaultPath ? "path" : "C:\\path\\to\\transcript.txt"}
                                  disabled={isUploading}
                                  className={cn(form.formState.errors.filePath ? "border-destructive" : "")}
                                  {...field}
                                />
                                {defaultPath && (
                                  <InputGroupAddon align="inline-start" className="">
                                    <InputGroupText>{defaultPath}</InputGroupText>
                                  </InputGroupAddon>
                                )}
                              </InputGroup>
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
                        {isUploading ? "Submitting..." : "Submit Path"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </>
            )}
          </DialogContent>
        </Dialog>
      </PermissionGuard>
    </Field>
  );
}
