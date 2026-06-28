import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Job } from "@/types/job";


interface JobDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog that warns the user before permanently deleting a job posting.
 *
 * Displays the job title and requires explicit confirmation before invoking
 * 
 */
export const JobDeleteDialog = ({
  isOpen,
  onOpenChange,
  job,
  onConfirm,
  onCancel,
}: JobDeleteDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl font-bold">Delete Job</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">"{job?.title}"</span>? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="ghost" onClick={onCancel} className="rounded-xl font-semibold">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="rounded-xl">
            Delete Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
