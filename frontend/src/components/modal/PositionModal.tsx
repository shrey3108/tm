/**
 * Modal for creating or updating a job position.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback } from "react";
import type {
  JobPositionRead,
} from "@/types/jobPosition";
import { useCreatePositionMutation, useUpdatePositionMutation } from "@/hooks/mutations/admin/useJobPosition";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
import { jobPositionCreateSchema, type JobPositionCreateFormValues } from "@/schemas/jobPosition";
import ErrorDisplay from "@/components/shared/ErrorDisplay";

interface PositionModalProps {
  show: boolean;
  handleClose: () => void;
  onPositionSaved: () => void;
  position: JobPositionRead | null;
}

const DEFAULT_POSITION_VALUES: JobPositionCreateFormValues = {
  name: "",

};

const PositionModal = ({
  show,
  handleClose,
  onPositionSaved,
  position,
}: PositionModalProps) => {
  const isEditMode = !!position;
  const createPositionMutation = useCreatePositionMutation();
  const updatePositionMutation = useUpdatePositionMutation();

  const mapItemToValues = useCallback(
    (p: JobPositionRead): JobPositionCreateFormValues => ({
      name: p.name,

    }),
    [],
  );

  const onSubmit = async (data: JobPositionCreateFormValues) => {
    if (isEditMode && position) {
      await updatePositionMutation.mutateAsync({ id: position.id, data });
    } else {
      await createPositionMutation.mutateAsync(data);
    }
    onPositionSaved();
    handleClose();
  };

  const formModal = useFormModal<JobPositionCreateFormValues, JobPositionRead>({
    schema: jobPositionCreateSchema,
    defaultValues: DEFAULT_POSITION_VALUES,
    item: position,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={"font-sans"}>{isEditMode ? "Edit Position" : "Create New Position"}</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-position-form" onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Senior Frontend Developer" {...field} />
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
          <Button type="submit" form="create-position-form" isLoading={isSubmitting}>
            {isEditMode ? "Update Position" : "Create Position"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PositionModal;
