/**
 * Modal component for creating and editing roles.
 * Provides a form to input role name and select permissions.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback, useEffect, useState } from "react";
import { adminPermissionService, adminRoleService } from "@/apis/admin";
import type { PermissionRead } from "@/types/admin";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Button,
  Input,
  Checkbox,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Field,
  FieldContent,
  FieldLabel,
  FieldDescription,
} from "@/components";
import { useFormModal } from "@/hooks";
import { roleCreateSchema, type RoleCreateFormValues } from "@/schemas/admin";
import { cn } from "@/lib/utils";
import { Required } from "@/components/job-form/Required";

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
  const [permissions, setPermissions] = useState<PermissionRead[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const isEditMode = !!editRoleId;

  const onSubmit = useCallback(
    async (data: RoleCreateFormValues) => {
      if (editRoleId) {
        await adminRoleService.updateRole(editRoleId, data);
      } else {
        await adminRoleService.createRole(data);
      }
      onSuccess();
      handleClose();
    },
    [editRoleId, onSuccess, handleClose],
  );

  const formModal = useFormModal<RoleCreateFormValues, any>({
    schema: roleCreateSchema,
    defaultValues: DEFAULT_ROLE_VALUES,
    show,
    onSubmit,
  });

  const {
    handleFormSubmit,
    isSubmitting,
    submitError,
    setSubmitError,
    reset,
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

  useEffect(() => {
    const fetchData = async () => {
      if (!show) return;

      setSearchTerm("");
      setFetchingData(true);
      setSubmitError(null);
      try {

        const permsData = await adminPermissionService.getAllPermissions();
        setPermissions(permsData.data);


        if (editRoleId) {
          const roleData = await adminRoleService.getRoleById(editRoleId);
          setValue("name", roleData.name);
          setValue(
            "permission_ids",
            roleData.permissions.map((p) => p.id),
          );
        } else {
          reset({
            name: "",
            permission_ids: [],
          });
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setSubmitError("Failed to load required data.");
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, [show, editRoleId, setValue, reset, setSubmitError]);

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

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onHide()}>
      {/* <DialogContent className="max-w-lg font-sans h-[550px] flex flex-col"> */}
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
        <DialogHeader className="p-2 pb-2 border-b border-muted-foreground/10 bg-muted/30">
          <DialogTitle className="text-2xl font-bold">
            {isEditMode ? "Edit Role" : "Create New Role"}
          </DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        {fetchingData ? (
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
                  <FormLabel className="text-md font-semibold">Assign Permissions <Required /></FormLabel>
                  <Input
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 w-full sm:w-64 rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-2xl border border-muted-foreground/10 flex-1 overflow-y-auto custom-scrollbar">
                  {filteredPermissions.map((permission) => {
                    const isChecked = selectedPermissionIds.includes(permission.id);
                    return (
                      <Field
                        key={permission.id}
                        orientation="horizontal"
                        className={cn(
                          "items-start gap-3 p-3 rounded-xl border-2 transition-all duration-200",
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
