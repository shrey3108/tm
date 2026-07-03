/**
 * Modal for creating or updating a job priority.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback } from "react";
import type { JobPriorityRead } from "@/types/jobPriority";
import { useCreatePriorityMutation, useUpdatePriorityMutation } from "@/hooks/mutations/admin/useJobPriority";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
import { jobPriorityCreateSchema, type JobPriorityCreateFormValues } from "@/schemas/jobPriority";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateJobPriorityModalProps {
  show: boolean;
  handleClose: () => void;
  onPrioritySaved: () => void;
  priority: JobPriorityRead | null;
}

const DEFAULT_PRIORITY_VALUES: JobPriorityCreateFormValues = {
  // name: "",
  duration_days: 7,
  associate_reminder_hours: 24
};

const CreateJobPriorityModal = ({
  show,
  handleClose,
  onPrioritySaved,
  priority,
}: CreateJobPriorityModalProps) => {
  const isEditMode = !!priority;
  const createPriorityMutation = useCreatePriorityMutation();
  const updatePriorityMutation = useUpdatePriorityMutation();

  const mapItemToValues = useCallback(
    (p: JobPriorityRead): JobPriorityCreateFormValues => ({
      // name: p.name,
      duration_days: p.duration_days,
      associate_reminder_hours: p.associate_reminder_hours
    }),
    [],
  );

  const onSubmit = async (data: JobPriorityCreateFormValues) => {
    if (isEditMode && priority) {
      await updatePriorityMutation.mutateAsync({ id: priority.id, data });
    } else {
      await createPriorityMutation.mutateAsync(data);
    }
    onPrioritySaved();
    handleClose();
  };

  const formModal = useFormModal<JobPriorityCreateFormValues, JobPriorityRead>({
    schema: jobPriorityCreateSchema,
    defaultValues: DEFAULT_PRIORITY_VALUES,
    item: priority,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Job Priority" : "Create New Job Priority"}</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-priority-form" onSubmit={handleFormSubmit} className="space-y-4">
            {/* <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Urgent, High, Standard" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}

            <FormField
              control={control}
              name="duration_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (Days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Number of days"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="associate_reminder_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder Hours</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Hours"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-priority-form" isLoading={isSubmitting}>
            {isEditMode ? "Update Priority" : "Create Priority"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateJobPriorityModal;
