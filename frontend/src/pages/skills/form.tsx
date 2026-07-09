import { useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCreateSkillMutation, useUpdateSkillMutation } from "@/hooks/mutations/admin/useSkill";
import { useSkill } from "@/hooks/queries/admin/useSkill";
import { skillCreateSchema, type SkillCreateFormValues } from "@/schemas/skill";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { slugify } from "@/utils/slug";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

export default function AdminSkillForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const toast = useToast();

  const createMutation = useCreateSkillMutation();
  const updateMutation = useUpdateSkillMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!slug;

  const { data: skills, loading: isLoadingSkills } = useSkill({ q: isEditMode && !location.state?.skill ? slug : undefined });

  const skill = isEditMode
    ? location.state?.skill || skills.find((s) => slugify(s.name) === slug) || skills[0]
    : null;

  const form = useForm({
    resolver: zodResolver(skillCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      default_weightage: 10,
    },
  });

  useEffect(() => {
    if (isEditMode && skill) {
      form.reset({
        name: skill.name,
        description: skill.description || "",
        default_weightage: skill.default_weightage ?? 10,
      });
    }
  }, [isEditMode, skill, form]);

  const onSubmit = async (values: SkillCreateFormValues) => {
    try {
      if (isEditMode) {
        const id = location.state?.skill?.id || skill?.id;
        if (!id) {
          toast.error("Skill ID not found");
          return;
        }
        await updateMutation.mutateAsync({ id, data: values });
        toast.success("Skill updated successfully");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Skill created successfully");
      }
      navigate("/dashboard/admin/skills");
    } catch (error) {
      const errorMessage = extractErrorMessage(error, "Failed to save skill");
      console.error(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (isEditMode && isLoadingSkills && !skill) {
    return (
      <AppPageShell width="wide">
        <div className="flex items-center justify-center min-h-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppPageShell>
    );
  }

  if (isEditMode && !isLoadingSkills && !skill) {
    return (
      <AppPageShell width="wide">
        <ErrorDisplay message="Skill not found" />
        <div className="mt-4">
          <Button onClick={() => navigate("/dashboard/admin/skills")}>
            Back to Skills
          </Button>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide">
      <PageHeader
        title={isEditMode ? "Edit Skill" : "Create Skill"}
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/admin/skills")}
            className="gap-2 h-9"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        }
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          {/* <CardTitle>{isEditMode ? "Skill Details" : "New Skill"}</CardTitle> */}
          {/* <CardDescription>
            Configure the name, description, and default weightage of this skill.
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
                    <FormLabel>Skill Name<Required /></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. React.js" {...field} />
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
                        placeholder="Briefly describe the skill..."
                        className="resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_weightage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weightage</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 10"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                  onClick={() => navigate("/dashboard/admin/skills")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isEditMode ? "Update Skill" : "Create Skill"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
