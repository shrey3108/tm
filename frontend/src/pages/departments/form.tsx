import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreateDepartmentMutation, useUpdateDepartmentMutation } from "@/hooks/mutations/admin/useDepartment";
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { departmentCreateSchema, type DepartmentCreateFormValues } from "@/schemas/department";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

export default function AdminDepartmentForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreateDepartmentMutation();
  const updateMutation = useUpdateDepartmentMutation();

  const isEditMode = !!slug;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const { data: departments, loading: isLoadingDepts } = useDepartment({ q: isEditMode && !location.state?.department ? slug : undefined });

  const department = isEditMode
    ? location.state?.department || departments.find((d) => slugify(d.name) === slug) || departments[0]
    : null;

  const form = useForm<DepartmentCreateFormValues>({
    resolver: zodResolver(departmentCreateSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (isEditMode && department) {
      form.reset({
        name: department.name,
        description: department.description || "",
      });
    }
  }, [isEditMode, department, form]);

  const onSubmit = async (values: DepartmentCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.department?.id || department?.id;
        if (!id) {
          toast.error("Department ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Department updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Department created successfully");
      }
      navigate("/dashboard/admin/departments");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save department");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingDepts && !department) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingDepts && !department) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Department not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/departments")}>
            Back to Departments
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Department" : "Create Department"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/departments")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          {/* <CardTitle>{isEditMode ? "Department Details" : "New Department"}</CardTitle> */}
          {/* <CardDescription>
            Configure the name and description of this department.
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
                    <FormLabel>Department Name<Required /></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Engineering" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Briefly describe the department..."
                        className="resize-y "
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/admin/departments")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Department" : "Create Department"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
