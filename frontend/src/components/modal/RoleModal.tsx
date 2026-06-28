/**
 * Modal component for creating and editing roles.
 * Provides a form to input role name and select permissions.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback, useEffect, useState } from "react";
import { useCreateRoleMutation, useUpdateRoleMutation } from "@/hooks/mutations/admin/useRole";
import { useAdminPermissions } from "@/hooks/queries/admin/useAdminPermissions";
import { useAdminRoleById } from "@/hooks/queries/admin/useAdminRoleById";
import type { RoleWithPermissions } from "@/types/permission-role";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { useFormModal } from "@/hooks/useFormModal";
import { roleCreateSchema, type RoleCreateFormValues } from "@/schemas/permission-role";
import { cn } from "@/lib/utils";
import { Required } from "@/components/shared/Required";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/shared/ToastProvider";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";


/**
 * Props for the RoleModal component.
 */
interface RoleModalProps {
  /** Controls visibility of the modal */
  show: boolean;
  /** Callback to close the modal */
  handleClose: () => void;
  /** Callback fired after role is successfully created or updated */
  onSuccess: () => void;
  /** ID of the role to edit (if in edit mode) */
  editRoleId?: string | null;
}

const DEFAULT_ROLE_VALUES: RoleCreateFormValues = {
  name: "",
  permission_ids: [],
};

/**
 * Modal dialog for creating or editing a role.
 */
const RoleModal = ({ show, handleClose, onSuccess, editRoleId }: RoleModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const toast = useToast();
  const isEditMode = !!editRoleId;
  const createRoleMutation = useCreateRoleMutation();
  const updateRoleMutation = useUpdateRoleMutation();

  const { data: permissions, loading: permissionsLoading } = useAdminPermissions({ isEnable: show });
  const { data: roleData, loading: roleLoading } = useAdminRoleById(show ? editRoleId : null);

  const fetchingData = permissionsLoading || (isEditMode && roleLoading);

  const mapItemToValues = useCallback(
    (role: RoleWithPermissions): RoleCreateFormValues => ({
      name: role.name,
      permission_ids: role.permissions.map((p) => p.id),
    }),
    [],
  );

  const onSubmit = async (data: RoleCreateFormValues) => {
    if (editRoleId) {
      await updateRoleMutation.mutateAsync({ id: editRoleId, data });
    } else {
      await createRoleMutation.mutateAsync(data);
    }
    onSuccess();
    handleClose();
  };

  const formModal = useFormModal<RoleCreateFormValues, RoleWithPermissions>({
    schema: roleCreateSchema,
    defaultValues: DEFAULT_ROLE_VALUES,
    item: roleData,
    show,
    mapItemToValues,
    onSubmit,
  });

  const {
    handleFormSubmit,
    isSubmitting,
    submitError,
    setSubmitError,
    setValue,
    control,
    watch,
  } = formModal;

  const selectedPermissionIds = watch("permission_ids") || [];

  const filteredPermissions = permissions.filter((permission) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      permission.name.toLowerCase().includes(searchLower) ||
      permission.description.toLowerCase().includes(searchLower)
    );
  });

  // Reset search term when modal opens
  useEffect(() => {
    if (show) setSearchTerm("");
  }, [show]);

  const onHide = () => {
    setSubmitError(null);
    handleClose();
  };

  const togglePermission = (permissionId: string) => {
    const current = [...selectedPermissionIds];
    const index = current.indexOf(permissionId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(permissionId);
    }
    setValue("permission_ids", current, { shouldValidate: true });
  };

  useEffect(() => {
    if (submitError) {
      toast.error(isEditMode ? "Failed to update role" : "Failed to create role");
    }
  }, [submitError]);


  return (
    <Dialog open={show} onOpenChange={(open) => !open && onHide()}>
      {/* <DialogContent className="max-w-lg font-sans h-[550px] flex flex-col"> */}
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
        <DialogHeader className="p-2 pb-2 border-b border-muted-foreground/10 bg-muted/30">
          <DialogTitle className="text-2xl font-bold">
            {isEditMode ? "Edit Role" : "Create New Role"}
          </DialogTitle>
        </DialogHeader>

        {fetchingData && !permissions.length ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <p className="text-muted-foreground animate-pulse font-medium">Loading data...</p>
          </div>
        ) : (
          <Form {...formModal}>
            <form id="role-form" onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0 space-y-2">
              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-row items-center gap-x-2">
                    <FormLabel className="text-md font-semibold px-2">Role Name <Required /></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. HR Manager"
                        className="h-9 w-full rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                <div className="flex sm:flex-row sm:items-center gap-2 px-2">
                  <FormLabel className="text-md font-semibold">Search Permissions </FormLabel>
                  <Input
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 w-full sm:w-64 rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-2xl border border-muted-foreground/10 flex-1 overflow-y-auto">
                  {filteredPermissions.map((permission) => {
                    const isChecked = selectedPermissionIds.includes(permission.id);
                    return (
                      <Field
                        key={permission.id}
                        orientation="horizontal"
                        className={cn(
                          "items-start gap-3 p-3 rounded-xl border-2 transition-all duration-200 h-20",
                          isChecked
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "bg-background/50 border-transparent hover:border-muted-foreground/20",
                        )}
                      >
                        <Checkbox
                          id={`perm-${permission.id}`}
                          checked={isChecked}
                          onCheckedChange={() => togglePermission(permission.id)}
                          className="mt-0.5"
                        />
                        <FieldContent>
                          <FieldLabel
                            htmlFor={`perm-${permission.id}`}
                            className={cn(
                              "text-sm font-bold leading-none transition-colors cursor-pointer",
                              isChecked ? "text-primary" : "text-foreground",
                            )}
                          >
                            {permission.name}
                          </FieldLabel>
                          <FieldDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                            {permission.description}
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    );
                  })}
                  {filteredPermissions.length === 0 && (
                    <div className="col-span-3 flex items-center justify-center p-8 text-muted-foreground text-sm font-medium">
                      No permissions match your search.
                    </div>
                  )}
                </div>
                <FormField
                  control={control}
                  name="permission_ids"
                  render={() => <FormMessage />}
                />
              </div>
            </form>
          </Form>
        )}
        <DialogFooter className="border-t gap-2 p-2">
          <Button
            variant="ghost"
            onClick={onHide}
            disabled={isSubmitting}
            className="rounded-xl font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="role-form"
            isLoading={isSubmitting}
            className="rounded-xl font-semibold px-6"
          >
            {isEditMode ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoleModal;
