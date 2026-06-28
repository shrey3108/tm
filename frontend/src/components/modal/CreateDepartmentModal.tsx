/**
 * Modal for creating or updating a department.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback } from "react";
import type { DepartmentRead } from "@/types/department";
import { useCreateDepartmentMutation, useUpdateDepartmentMutation } from "@/hooks/mutations/admin/useDepartment";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
import { departmentCreateSchema, type DepartmentCreateFormValues } from "@/schemas/department";
import ErrorDisplay from "@/components/shared/ErrorDisplay";

interface CreateDepartmentModalProps {
  show: boolean;
  handleClose: () => void;
  onDepartmentSaved: () => void;
  department: DepartmentRead | null;
}

const DEFAULT_DEPARTMENT_VALUES: DepartmentCreateFormValues = {
  name: "",
  description: "",
};

const CreateDepartmentModal = ({
  show,
  handleClose,
  onDepartmentSaved,
  department,
}: CreateDepartmentModalProps) => {
  const isEditMode = !!department;
  const createDepartmentMutation = useCreateDepartmentMutation();
  const updateDepartmentMutation = useUpdateDepartmentMutation();

  const mapItemToValues = useCallback(
    (d: DepartmentRead): DepartmentCreateFormValues => ({
      name: d.name,
      description: d.description || "",
    }),
    [],
  );

  const onSubmit = async (data: DepartmentCreateFormValues) => {
    if (isEditMode && department) {
      await updateDepartmentMutation.mutateAsync({ id: department.id, data });
    } else {
      await createDepartmentMutation.mutateAsync(data);
    }
    onDepartmentSaved();
    handleClose();
  };

  const formModal = useFormModal<DepartmentCreateFormValues, DepartmentRead>({
    schema: departmentCreateSchema,
    defaultValues: DEFAULT_DEPARTMENT_VALUES,
    item: department,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Department" : "Create New Department"}</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-department-form" onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Engineering" {...field} />
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
                    <Textarea
                      placeholder="Briefly describe the department..."
                      rows={4}
                      {...field}
                      value={field.value || ""}
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
          <Button type="submit" form="create-department-form" isLoading={isSubmitting}>
            {isEditMode ? "Update Department" : "Create Department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDepartmentModal;
