import { useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { toast } from "sonner";
import { extractErrorMessage } from "@/utils/error";
import { transcriptService } from "@/apis/transcript";
import type { Job } from "@/types/job";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { ALLOWED_TRANSCRIPT_FILE_TYPES } from "@/constants";

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
 * Now handles direct multiple file uploads instead of file paths.
 */
export function TranscriptUpload({
  stageId,
  onSuccess,
  className,
  // label = "Transcribe",
  disabled,
}: TranscriptUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!stageId) {
      toast.error("Process stage ID is missing");
      return;
    }

    setIsUploading(true);
    try {
      const response = await transcriptService.uploadTranscript(stageId, Array.from(files));
      toast.success(response.message || "Transcripts uploaded successfully!");
      if (onSuccess) onSuccess();
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to upload transcripts");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Field className={cn("w-full mr-5", className)}>
      <PermissionGuard permissions={PERMISSIONS.CANDIDATES_ACCESS} hideWhenDenied>
        <div className="inline-flex">
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={disabled || isUploading}
            accept={ALLOWED_TRANSCRIPT_FILE_TYPES.join(",")}
          />
          <Button
            variant="outline"
            className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-9"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            ) : (
              <Upload className="mr-2 w-4 h-4" />
            )}
            Transcript
          </Button>
        </div>
      </PermissionGuard>
    </Field>
  );
}
