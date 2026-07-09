import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreatePositionMutation, useUpdatePositionMutation } from "@/hooks/mutations/admin/useJobPosition";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { jobPositionCreateSchema, type JobPositionCreateFormValues } from "@/schemas/jobPosition";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

export default function AdminPositionForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreatePositionMutation();
  const updateMutation = useUpdatePositionMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!slug;

  // Retrieve position details matching the slug
  const { data: positions, loading: isLoadingPositions } = useJobPosition({
    q: isEditMode && !location.state?.position ? slug : undefined,
  });

  const position = isEditMode
    ? location.state?.position || positions.find((p) => slugify(p.name) === slug) || positions[0]
    : null;

  const form = useForm<JobPositionCreateFormValues>({
    resolver: zodResolver(jobPositionCreateSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (isEditMode && position) {
      form.reset({
        name: position.name,
      });
    }
  }, [isEditMode, position, form]);

  const onSubmit = async (values: JobPositionCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.position?.id || position?.id;
        if (!id) {
          toast.error("Position ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Job position updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Job position created successfully");
      }
      navigate("/dashboard/admin/criteria-stages/positions");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save position");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingPositions && !position) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingPositions && !position) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Position not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/criteria-stages/positions")}>
            Back to Positions
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Position" : "Create Position"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/criteria-stages/positions")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          {/* <CardTitle>{isEditMode ? "Position Details" : "New Position"}</CardTitle>
          <CardDescription>
            Configure the name of this job position.
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
                    <FormLabel>Position Name<Required /></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Senior Frontend Developer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/admin/criteria-stages/positions")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Position" : "Create Position"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
