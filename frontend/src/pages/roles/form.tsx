import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreateRoleMutation, useUpdateRoleMutation } from "@/hooks/mutations/admin/useRole";
import { useAdminRoles } from "@/hooks/queries/admin/useAdminRoles";
import { useAdminRoleById } from "@/hooks/queries/admin/useAdminRoleById";
import { useAdminPermissions } from "@/hooks/queries/admin/useAdminPermissions";
import { roleCreateSchema, type RoleCreateFormValues } from "@/schemas/permission-role";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Required } from "@/components/shared/Required";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { cn } from "@/lib/utils";

export default function AdminRoleForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const createMutation = useCreateRoleMutation();
  const updateMutation = useUpdateRoleMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!slug;

  // Retrieve basic role list matching the slug
  const { data: roles, loading: isLoadingRoles } = useAdminRoles({
    q: isEditMode && !location.state?.role ? slug : undefined,
  });

  const basicRole = isEditMode
    ? location.state?.role || roles.find((r) => slugify(r.name) === slug) || roles[0]
    : null;

  // Retrieve detailed role permissions by role ID
  const { data: roleDetails, loading: isLoadingRoleDetails } = useAdminRoleById(basicRole?.id);

  // Retrieve all available permissions
  const { data: permissions, loading: isLoadingPermissions } = useAdminPermissions();

  const isLoading = isLoadingRoles || isLoadingRoleDetails || isLoadingPermissions;

  const form = useForm({
    resolver: zodResolver(roleCreateSchema),
    defaultValues: {
      name: "",
      permission_ids: [],
    },
  });

  const selectedPermissionIds = form.watch("permission_ids") || [];

  useEffect(() => {
    if (isEditMode && roleDetails) {
      form.reset({
        name: roleDetails.name,
        permission_ids: roleDetails.permissions.map((p) => p.id),
      });
    }
  }, [isEditMode, roleDetails, form]);

  const togglePermission = (permissionId: string) => {
    const current = [...selectedPermissionIds];
    const index = current.indexOf(permissionId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(permissionId);
    }
    form.setValue("permission_ids", current, { shouldValidate: true });
  };

  const onSubmit = async (values: RoleCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = basicRole?.id;
        if (!id) {
          toast.error("Role ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Role updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Role created successfully");
      }
      navigate("/dashboard/admin/roles");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save role");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  const filteredPermissions = permissions.filter((permission) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      permission.name.toLowerCase().includes(searchLower) ||
      permission.description.toLowerCase().includes(searchLower)
    );
  });

  if (isEditMode && isLoading && !roleDetails) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoading && !roleDetails) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Role not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/roles")}>
            Back to Roles
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Role" : "Create Role"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/roles")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          {/* <CardTitle>{isEditMode ? "Role Details" : "New Role"}</CardTitle> */}
          {/* <CardDescription>
            Configure role name and select the functional permissions to assign.
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name <Required /></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HR Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center  gap-4">
                  <FormLabel className="text-md font-semibold">Assign Permissions</FormLabel>
                  <Input
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 bg-muted/30 rounded-2xl border border-muted-foreground/10 overflow-y-auto custom-scrollbar">
                  {filteredPermissions.map((permission) => {
                    const isChecked = selectedPermissionIds.includes(permission.id);
                    return (
                      <Field
                        key={permission.id}
                        orientation="horizontal"
                        className={cn(
                          "items-start gap-3 p-3 rounded-xl border-2 transition-all duration-200 min-h-10 cursor-pointer ",
                          isChecked
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "bg-background/50 border-muted-foreground/10 hover:border-muted-foreground/20",
                        )}
                        onClick={() => togglePermission(permission.id)}
                      >
                        <Checkbox
                          id={`perm-${permission.id}`}
                          checked={isChecked}
                          onCheckedChange={() => togglePermission(permission.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <FieldContent>
                          <FieldLabel
                            htmlFor={`perm-${permission.id}`}
                            className={cn(
                              "text-sm font-bold leading-none cursor-pointer",
                              isChecked ? "text-primary" : "text-foreground",
                            )}
                            onClick={(e) => e.stopPropagation()}
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
                    <div className="col-span-full flex items-center justify-center p-8 text-muted-foreground text-sm font-medium">
                      No permissions match your search.
                    </div>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="permission_ids"
                  render={() => <FormMessage />}
                />
              </div>

              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/admin/roles")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Role" : "Create Role"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
