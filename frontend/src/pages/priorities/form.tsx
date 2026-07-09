import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreatePriorityMutation, useUpdatePriorityMutation } from "@/hooks/mutations/admin/useJobPriority";
import { useJobPriorities } from "@/hooks/queries/admin/useJobPriority";
import { jobPriorityCreateSchema, type JobPriorityCreateFormValues } from "@/schemas/jobPriority";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

export default function AdminPriorityForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreatePriorityMutation();
  const updateMutation = useUpdatePriorityMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!slug;


  const { data: priorities, loading: isLoadingPriorities } = useJobPriorities({
    q: isEditMode && !location.state?.priority ? slug : undefined,
  });

  const priority = isEditMode
    ? location.state?.priority || priorities.find((p) => slugify(p.name) === slug) || priorities[0]
    : null;

  const form = useForm<JobPriorityCreateFormValues>({
    resolver: zodResolver(jobPriorityCreateSchema),
    defaultValues: {
      duration_days: 7,
      associate_reminder_hours: 24,
    },
  });

  useEffect(() => {
    if (isEditMode && priority) {
      form.reset({
        duration_days: priority.duration_days,
        associate_reminder_hours: priority.associate_reminder_hours,
      });
    }
  }, [isEditMode, priority, form]);

  const onSubmit = async (values: JobPriorityCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.priority?.id || priority?.id;
        if (!id) {
          toast.error("Priority ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Job priority updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Job priority created successfully");
      }
      navigate("/dashboard/admin/settings/priorities");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save priority");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingPriorities && !priority) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingPriorities && !priority) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Priority not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/settings/priorities")}>
            Back to Priorities
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Priority" : "Create Priority"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/settings/priorities")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          {/* <CardTitle>{isEditMode ? "Priority Details" : "New Priority"}</CardTitle> */}
          {/* <CardDescription>
            Configure the duration and reminder hours of this job priority.
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="duration_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Days)<Required /> </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="Number of days"
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="associate_reminder_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reminder Hours<Required /></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Hours (multiple of 24)"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
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
                  onClick={() => navigate("/dashboard/admin/settings/priorities")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Priority" : "Create Priority"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
