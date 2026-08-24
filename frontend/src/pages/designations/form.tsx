import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useCreateDesignationMutation,
  useUpdateDesignationMutation,
} from "@/hooks/mutations/admin/useDesignation";
import { useDesignations } from "@/hooks/queries/admin/useDesignation";
import {
  designationCreateSchema,
  type DesignationCreateFormValues,
} from "@/schemas/designation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

export default function AdminDesignationForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreateDesignationMutation();
  const updateMutation = useUpdateDesignationMutation();

  const isEditMode = !!slug;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const { data: designations, loading: isLoadingDesignations } = useDesignations();

  const designation = isEditMode
    ? location.state?.designation ||
      designations.find((d) => slugify(d.name) === slug) ||
      designations[0]
    : null;

  const form = useForm<DesignationCreateFormValues>({
    resolver: zodResolver(designationCreateSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (isEditMode && designation) {
      form.reset({
        name: designation.name,
      });
    }
  }, [isEditMode, designation, form]);

  const onSubmit = async (values: DesignationCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.designation?.id || designation?.id;
        if (!id) {
          toast.error("Designation ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Designation updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Designation created successfully");
      }
      navigate("/dashboard/admin/designations");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save designation");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingDesignations && !designation) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingDesignations && !designation) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Designation not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/designations")}>
            Back to Designations
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Designation" : "Create Designation"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/designations")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader />
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Designation Name <Required />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Senior Software Engineer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/admin/designations")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Designation" : "Create Designation"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
