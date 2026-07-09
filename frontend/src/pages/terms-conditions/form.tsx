import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateGuidelineMutation, useUpdateGuidelineMutation } from "@/hooks/mutations/admin/useGuideline";
import { useGuidelines } from "@/hooks/queries/admin/useGuideline";
import { guidelineCreateSchema, type GuidelineCreateFormValues } from "@/schemas/guideline";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Required } from "@/components/shared/Required";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";

export default function AdminGuidelineForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreateGuidelineMutation();
  const updateMutation = useUpdateGuidelineMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!slug;

  const getGuidelineSlug = (content: string) => slugify(content.slice(0, 30) || "guideline");

  // Retrieve guideline details matching the slug
  const { data: guidelines, loading: isLoadingGuidelines } = useGuidelines({
    q: isEditMode && !location.state?.guideline ? slug : undefined,
  });

  const guideline = isEditMode
    ? location.state?.guideline || guidelines.find((g) => getGuidelineSlug(g.content) === slug) || guidelines[0]
    : null;

  const form = useForm({
    resolver: zodResolver(guidelineCreateSchema),
    defaultValues: {
      content: "",
      is_default: false,
    },
  });

  useEffect(() => {
    if (isEditMode && guideline) {
      form.reset({
        content: guideline.content,
        is_default: guideline.is_default,
      });
    }
  }, [isEditMode, guideline, form]);

  const onSubmit = async (values: GuidelineCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.guideline?.id || guideline?.id;
        if (!id) {
          toast.error("Term & condition ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Term & condition updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Term & condition created successfully");
      }
      navigate("/dashboard/admin/settings/terms-conditions");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save term & condition");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingGuidelines && !guideline) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingGuidelines && !guideline) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Term & condition not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/settings/terms-conditions")}>
            Back to Terms & Conditions
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Term & Condition" : "Create Term & Condition"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/settings/terms-conditions")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>{isEditMode ? "Term & Condition Details" : "New Term & Condition"}</CardTitle>
          {/* <CardDescription>
            Configure the contents of this terms & conditions.
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Content <Required />
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter terms & conditions instructions here..."
                        className="min-h-50 resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Default Term & Condition</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Set this as the default term & condition for new templates or processes.
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
                  onClick={() => navigate("/dashboard/admin/settings/terms-conditions")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Guideline" : "Create Guideline"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
