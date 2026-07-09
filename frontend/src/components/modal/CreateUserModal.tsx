/**
 * Modal component for creating new users in the admin panel.
 * Provides a form with role selection to create user accounts.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback, useMemo } from "react";
import { useCreateUserMutation, useUpdateUserMutation } from "@/hooks/mutations/admin/useUser";
import type { UserAdminRead } from "@/types/permission-role";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
import { userCreateSchema, type UserCreateFormValues } from "@/schemas/user";
import { useAdminRoles } from "@/hooks/queries/admin/useAdminRoles";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";



/**
 * Props for the CreateUserModal component.
 */
interface CreateUserModalProps {
  show: boolean;
  handleClose: () => void;
  onUserSaved: () => void;
  user?: UserAdminRead | null;
}

const DEFAULT_USER_VALUES: UserCreateFormValues = {
  is_active: true,
  role_id: "",
  full_name: "",
  email: "",
  password: "",
};

/**
 * Modal dialog for creating or editing a user account.
 */
const CreateUserModal = ({ show, handleClose, onUserSaved, user }: CreateUserModalProps) => {

  const isEditMode = !!user;
  const createUserMutation = useCreateUserMutation();
  const updateUserMutation = useUpdateUserMutation();

  const mapItemToValues = useCallback(
    (u: UserAdminRead): UserCreateFormValues => ({
      full_name: u.full_name || "",
      email: u.email,
      is_active: u.is_active,
      role_id: u.role_id,
      password: "",
    }),
    [],
  );

  const onSubmit = async (data: UserCreateFormValues) => {
    if (isEditMode && user) {
      const updateData = {
        full_name: data.full_name,
        is_active: data.is_active,
        role_id: data.role_id,
      };
      await updateUserMutation.mutateAsync({ id: user.id, data: updateData });
    } else {
      const payload = { ...data };
      if (!payload.password) {
        delete payload.password;
      }
      await createUserMutation.mutateAsync(payload);
    }
    onUserSaved();
    handleClose();
  };

  const formModal = useFormModal<UserCreateFormValues, UserAdminRead>({
    schema: userCreateSchema,
    defaultValues: DEFAULT_USER_VALUES,
    item: user || null,
    show,
    mapItemToValues,
    onSubmit,
  });

  const {
    handleFormSubmit,
    isSubmitting,
    submitError,
    control,
  } = formModal;

  const { data: roles, loading } = useAdminRoles({ isEnable: show });

  const roleOptions = useMemo(() => {
    if (!roles) return [];
    return roles
      .filter((role) => role.name !== "superadmin")
      .map((role) => ({
        id: role.id,
        label: role.name,
      }));
  }, [roles]);

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit User" : "Create New User"}</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-user-form" onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter email"
                        disabled={isEditMode}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        options={roleOptions}
                        placeholder="Select a role"
                        searchPlaceholder="Search roles..."
                        loading={loading}
                        loadingPlaceholder="Loading roles..."
                        triggerClassName="w-full"
                        getTriggerLabel={(selected) => {
                          const foundRole = roles?.find((r) => r.id === selected.id);
                          if (foundRole) return foundRole.name;
                          return user?.role_name || selected.label;
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Account</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable this user's access to the platform.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" isLoading={isSubmitting}>
            {isEditMode ? "Update User" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserModal;
