import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/ToastProvider";
import { extractErrorMessage } from "@/utils/error";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { useUploadResumeMutation } from "@/hooks/mutations/jobs/useResumeMutation";

const UPLOAD_PERMISSION = "candidate:upload"; // temp fix

/**
 * Props for the QuickResumeUpload component.
 */
interface QuickResumeUploadProps {
  /** ID of the job to upload the resume for */
  jobId: string;
  /** Title of the job */
  jobTitle?: string;
  /** Callback function called after successful upload */
  onSuccess?: () => void;
  /** Visual style variant of the button */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Size of the button */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional CSS class names */
  className?: string;
  /** Text label to display on the button */
  label?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * A reusable component for quickly uploading a resume for a specific job.
 * Handles file selection, upload logic, and notifications.
 */
const QuickResumeUpload = ({
  jobId,
  jobTitle,
  onSuccess,
  variant = "outline",
  size,
  className = "",
  label = "Upload Resume",
  disabled = false,
}: QuickResumeUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { mutateAsync: uploadResume, isPending: isUploading } = useUploadResumeMutation();

  /**
   * Triggers the hidden file input click.
   */
  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  /**
   * Handles the file selection and upload process.
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = Number(import.meta.env.VITE_RESUME_MAX_SIZE_MB) || 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.warn(`Resume size must be less than ${MAX_SIZE_MB} MB.`);
      event.target.value = "";
      return;
    }

    try {
      await uploadResume({ jobId, files: [file], jobTitle });
      toast.success("Resume uploaded successfully!");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Upload failed:", error);
      const errorMessage = extractErrorMessage(error, "Failed to upload resume.");
      toast.error(errorMessage);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <PermissionGuard permissions={UPLOAD_PERMISSION} hideWhenDenied>
      <div className={`quick-resume-upload inline-flex ${className}`}>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx"
          disabled={disabled || isUploading}
        />
        <Button
          variant={variant}
          size={size}
          isLoading={isUploading}
          onClick={handleButtonClick}
          disabled={disabled}
          className="whitespace-nowrap"
        >
          {label}
        </Button>
      </div>
    </PermissionGuard>
  );
};

export default QuickResumeUpload;
