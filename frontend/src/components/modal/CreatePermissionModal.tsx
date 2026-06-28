/**
 * Modal component for creating new permissions.
 * Provides a form to input permission name and description.
 */

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
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
import { permissionCreateSchema, type PermissionCreateFormValues } from "@/schemas/permission-role";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { useCreatePermissionMutation } from "@/hooks/mutations/admin/usePermission";

/**
 * Props for the CreatePermissionModalProps component.
 */
interface CreatePermissionModalProps {
  /** Controls visibility of the modal */
  show: boolean;
  /** Callback to close the modal */
  handleClose: () => void;
  /** Callback fired after permission is successfully created */
  onPermissionCreated: () => void;
}

/**
 * Modal dialog for creating a new permission.
 */
const CreatePermissionModal = ({
  show,
  handleClose,
  onPermissionCreated,
}: CreatePermissionModalProps) => {
  const { mutateAsync: createPermission } = useCreatePermissionMutation();

  const onSubmit = useCallback(
    async (data: PermissionCreateFormValues) => {
      await createPermission(data);
      onPermissionCreated();
      handleClose();
    },
    [onPermissionCreated, handleClose, createPermission]
  );

  const formModal = useFormModal<PermissionCreateFormValues, null>({
    schema: permissionCreateSchema,
    defaultValues: {
      name: "",
      description: "",
    },
    show,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Permission</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-permission-form" onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permission Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. users:write" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Describe what this permission allows" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-permission-form" isLoading={isSubmitting}>
            Create Permission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePermissionModal;
