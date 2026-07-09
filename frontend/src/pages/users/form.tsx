import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreateUserMutation, useUpdateUserMutation } from "@/hooks/mutations/admin/useUser";
import { useAdminUsers } from "@/hooks/queries/admin/useAdminUsers";
import { useAdminRoles } from "@/hooks/queries/admin/useAdminRoles";
import { userCreateSchema, type UserCreateFormValues } from "@/schemas/user";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

export default function AdminUserForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!slug;

  // Retrieve user details matching the slug
  const { data: users, loading: isLoadingUsers } = useAdminUsers({
    q: isEditMode && !location.state?.user ? slug : undefined,
  });

  const user = isEditMode
    ? location.state?.user || users.find((u) => slugify(u.full_name || u.email) === slug) || users[0]
    : null;

  const { data: roles, loading: isLoadingRoles } = useAdminRoles();

  const form = useForm({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      full_name: "",
      email: "",
      role_id: "",
      is_active: true,
      password: "",
    },
  });

  useEffect(() => {
    if (isEditMode && user) {
      form.reset({
        full_name: user.full_name || "",
        email: user.email,
        role_id: user.role_id,
        is_active: user.is_active,
        password: "",
      });
    }
  }, [isEditMode, user, form]);

  const onSubmit = async (values: UserCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.user?.id || user?.id;
        if (!id) {
          toast.error("User ID not found");
          return;
        }
        const updateData = {
          full_name: values.full_name,
          is_active: values.is_active,
          role_id: values.role_id,
        };
        await updateMutation.mutateAsync({ id, data: updateData });
        toast.success("User updated successfully");
      } else {
        const payload = { ...values };
        if (!payload.password) {
          delete payload.password;
        }
        await createMutation.mutateAsync(payload);
        toast.success("User created successfully");
      }
      navigate("/dashboard/admin/users");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save user");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingUsers && !user) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingUsers && !user) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="User not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/users")}>
            Back to Users
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit User" : "Create User"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/users")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          {/* <CardTitle>{isEditMode ? "User Details" : "New User"}</CardTitle> */}
          {/* <CardDescription>
            Configure user details, authentication, and platform access role.
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name<Required /></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} disabled={isEditMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address<Required /></FormLabel>
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
                  control={form.control}
                  name="role_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role<Required /></FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={roles
                            .filter((role) => role.name !== "superadmin")
                            .map((role) => ({ id: role.id, label: role.name }))}
                          placeholder="Select a role"
                          searchPlaceholder="Search roles..."
                          disabled={isLoadingRoles}
                          triggerClassName="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
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

              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/admin/users")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update User" : "Create User"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
