import { useEffect, useState } from "react";
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

  const filePath = form.watch("filePath");

  const getFullPath = (path: string) => {
    if (!path) return defaultPath;
    const separator = defaultPath.includes('/') ? '/' : '\\';
    const cleanFilePath = path.startsWith(separator) ? path.substring(1) : path;
    return defaultPath
      ? (defaultPath.endsWith(separator)
        ? `${defaultPath}${cleanFilePath}`
        : `${defaultPath}${separator}${cleanFilePath}`)
      : path;
  };

  const fullPathPreview = getFullPath(filePath);

  useEffect(() => {
    if (open) {
      const fetchDefaultPath = async () => {
        setIsLoading(true)
        try {
          const response = await transcriptService.getDefaultTranscriptPath()
          // form.reset({ filePath: response.default_path || "" })
          setDefaultPath(response.default_path || "")
        } catch (error: any) {
          const errorMessage = extractErrorMessage(error);
          toast.error(errorMessage || "Failed to fetch default path")
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
      const fullPath = getFullPath(values.filePath);

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
                  <DialogTitle className="text-xl font-bold">Transcript Path</DialogTitle>
                  <DialogDescription className="text-muted-foreground/80">
                    {defaultPath && "Enter the filename and extension of the transcript file."}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4 py-2">
                      {/* Read Only Base Path */}
                      <div className="space-y-2">
                        <Input
                          readOnly
                          value={defaultPath}
                          className="rounded-2xl bg-muted/50 border-muted-foreground/30 font-medium h-12 text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                        />
                      </div>

                      {/* File Name Input */}
                      <FormField
                        control={form.control}
                        name="filePath"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Enter filename (e.g., interview.pdf)"
                                disabled={isUploading}
                                className={cn(
                                  "rounded-2xl h-12 border-muted-foreground/30 ",
                                  form.formState.errors.filePath ? "border-destructive" : ""
                                )}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs ml-2" />
                          </FormItem>
                        )}
                      />
                      {!form.formState.errors.filePath && form.formState.isValid && <span className="text-muted-foreground/70 flex items-center ml-1">{fullPathPreview}</span>}
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={isUploading || !form.formState.isValid}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Path"
                        )}
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
