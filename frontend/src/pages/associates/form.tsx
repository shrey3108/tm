import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreateAssociateMutation, useUpdateAssociateMutation } from "@/hooks/mutations/admin/useAssociate";
import { useAssociates } from "@/hooks/queries/admin/useAssociate";
import { associateCreateSchema, type AssociateCreateFormValues } from "@/schemas/associate";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

export default function AdminAssociateForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreateAssociateMutation();
  const updateMutation = useUpdateAssociateMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!slug;

  // Retrieve associate details matching the slug
  const { data: associates, loading: isLoadingAssociates } = useAssociates({
    q: isEditMode && !location.state?.associate ? slug : undefined,
  });

  const associate = isEditMode
    ? location.state?.associate || associates.find((a) => slugify(a.name) === slug) || associates[0]
    : null;

  const form = useForm<AssociateCreateFormValues>({
    resolver: zodResolver(associateCreateSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  useEffect(() => {
    if (isEditMode && associate) {
      form.reset({
        name: associate.name,
        email: associate.email,
      });
    }
  }, [isEditMode, associate, form]);

  const onSubmit = async (values: AssociateCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.associate?.id || associate?.id;
        if (!id) {
          toast.error("Associate ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Associate updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Associate created successfully");
      }
      navigate("/dashboard/admin/associates");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save associate");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingAssociates && !associate) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingAssociates && !associate) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Associate not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/associates")}>
            Back to Associates
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Associate" : "Create Associate"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/associates")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          {/* <CardTitle>{isEditMode ? "Associate Details" : "New Associate"}</CardTitle>
          <CardDescription>
            Configure the name and email address of this associate.
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
                    <FormLabel>Associate Name<Required /></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. John Doe" {...field} />
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
                    <FormLabel>Email Address <Required /></FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g. john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/admin/associates")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Associate" : "Create Associate"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
