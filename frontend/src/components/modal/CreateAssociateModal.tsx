/**
 * Modal for creating or updating an associate.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback } from "react";
import type { AssociateRead, AssociateCreate, AssociateUpdate } from "@/types/associate";
import { useCreateAssociateMutation, useUpdateAssociateMutation } from "@/hooks/mutations/admin/useAssociate";
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
import { associateCreateSchema, } from "@/schemas/associate";
import ErrorDisplay from "@/components/shared/ErrorDisplay";

interface CreateAssociateModalProps {
  show: boolean;
  handleClose: () => void;
  onAssociateSaved: () => void;
  associate: AssociateRead | null;
}

const DEFAULT_ASSOCIATE_VALUES: AssociateCreate = {
  name: "",
  email: "",
};

const CreateAssociateModal = ({ show, handleClose, onAssociateSaved, associate }: CreateAssociateModalProps) => {
  const isEditMode = !!associate;
  const createAssociateMutation = useCreateAssociateMutation();
  const updateAssociateMutation = useUpdateAssociateMutation();

  const mapItemToValues = useCallback(
    (a: AssociateRead): AssociateCreate => ({
      name: a.name,
      email: a.email,
    }),
    [],
  );

  const onSubmit = async (data: AssociateCreate | AssociateUpdate) => {
    if (isEditMode && associate) {
      await updateAssociateMutation.mutateAsync({ id: associate.id, data: data as AssociateUpdate });
    } else {
      await createAssociateMutation.mutateAsync(data as AssociateCreate);
    }
    onAssociateSaved();
    handleClose();
  };

  const formModal = useFormModal<AssociateCreate | AssociateUpdate, AssociateRead>({
    schema: associateCreateSchema,
    defaultValues: DEFAULT_ASSOCIATE_VALUES,
    item: associate,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle>{isEditMode ? "Edit Associate" : "Create New Associate"}</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-associate-form" onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Associate Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="e.g. john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleFormSubmit} disabled={isSubmitting}>
            {isEditMode ? "Update Associate" : "Create Associate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAssociateModal;
