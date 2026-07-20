/**
 * Modal for creating or updating a designation.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback } from "react";
import type { DesignationRead } from "@/types/designation";
import {
  useCreateDesignationMutation,
  useUpdateDesignationMutation,
} from "@/hooks/mutations/admin/useDesignation";
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
import { designationCreateSchema, type DesignationCreateFormValues } from "@/schemas/designation";
import ErrorDisplay from "@/components/shared/ErrorDisplay";

interface CreateDesignationModalProps {
  show: boolean;
  handleClose: () => void;
  onDesignationSaved: () => void;
  designation?: DesignationRead | null;
}

const DEFAULT_DESIGNATION_VALUES: DesignationCreateFormValues = {
  name: "",
};

const CreateDesignationModal = ({
  show,
  handleClose,
  onDesignationSaved,
  designation = null,
}: CreateDesignationModalProps) => {
  const isEditMode = !!designation;
  const createDesignationMutation = useCreateDesignationMutation();
  const updateDesignationMutation = useUpdateDesignationMutation();

  const mapItemToValues = useCallback(
    (d: DesignationRead): DesignationCreateFormValues => ({
      name: d.name,
    }),
    []
  );

  const onSubmit = async (data: DesignationCreateFormValues) => {
    if (isEditMode && designation) {
      await updateDesignationMutation.mutateAsync({ id: designation.id, data });
    } else {
      await createDesignationMutation.mutateAsync(data);
    }
    onDesignationSaved();
    handleClose();
  };

  const formModal = useFormModal<DesignationCreateFormValues, DesignationRead>({
    schema: designationCreateSchema,
    defaultValues: DEFAULT_DESIGNATION_VALUES,
    item: designation,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Designation" : "Create New Designation"}</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-designation-form" onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Senior Software Engineer" {...field} />
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
          <Button type="button" onClick={handleFormSubmit} disabled={isSubmitting}>
            {isEditMode ? "Update Designation" : "Create Designation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDesignationModal;
