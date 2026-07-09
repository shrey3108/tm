/**
 * @module AdminJobCriteriaForm
 * @component AdminJobCriteriaForm
 *
 * Form component for creating and editing job evaluation criteria, with validation.
 */
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Save, ArrowLeft, Sparkle } from "lucide-react";

import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { enhanceJobCriteriaSchema, jobCriteriaCreateSchema, type JobCriteriaCreateFormValues } from "@/schemas/jobCriteria";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    useCreateCriterionMutation,
    useEnhanceCriterionPromptMutation,
    useUpdateCriterionMutation,
} from "@/hooks/mutations/admin/useJobCriteria";
import { useJobCriteria, useJobCriteriaById } from "@/hooks/queries/admin/useJobCriteria";
import type { CriterionRead } from "@/types/jobCriteria";
import { slugify } from "@/utils/slug";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { extractErrorMessage } from "@/utils/error";
import { Required } from "@/components/shared/Required";

/**
 * Form page for creating or editing job evaluation criteria.
 * Includes job selection (apply to all or specific jobs) and optional filter by tags.
 */
export default function AdminJobCriteriaForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { slug, id: paramId } = useParams<{ slug?: string, id?: string }>();
    const toast = useToast();

    const createMutation = useCreateCriterionMutation();
    const updateMutation = useUpdateCriterionMutation();
    const enhanceMutation = useEnhanceCriterionPromptMutation();
    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    const { data: criteria, loading: isLoadingCriteria } = useJobCriteria(0, 100);
    const { data: criterionData, loading: isLoadingCriterionData } = useJobCriteriaById(location.state?.id as string);

    const criterion = paramId ? criterionData : criteria.find(c => slugify(c.name) === slug || c.id === (location.state as any)?.id);
    const isFetchingData = paramId ? isLoadingCriterionData : isLoadingCriteria;

    const [isEditMode, setIsEditMode] = useState(false);

    const form = useForm<JobCriteriaCreateFormValues>({
        resolver: zodResolver(jobCriteriaCreateSchema),
        defaultValues: {
            name: "",
            description: "",
            prompt_text: "",
        },
    });

    useEffect(() => {
        const stateData = location.state as any;

        const initializeForm = (c: CriterionRead) => {
            form.reset({
                name: c.name,
                description: c.description || "",
                prompt_text: c.prompt_text || "",
            });
        };

        if (slug && slug !== "new") {
            setIsEditMode(true);
            if (stateData?.criteria) {
                initializeForm(stateData.criteria);
            } else if (!isFetchingData) {
                if (criterion) {
                    initializeForm(criterion);
                } else {
                    toast.error("Criteria not found");
                    navigate("/dashboard/admin/criteria-stages/criteria");
                }
            }
        }
    }, [slug, location.state, form, toast, navigate, criterion, isFetchingData]);

    const onSubmit = async (values: JobCriteriaCreateFormValues) => {
        try {
            const payload = {
                name: values.name,
                description: values.description,
                prompt_text: values.prompt_text,
            };

            if (isEditMode) {
                const id = (location.state as any)?.id || criterion?.id;
                if (!id) throw new Error("Missing criteria ID for update");
                await updateMutation.mutateAsync({ id, data: payload });
                toast.success("Job criteria updated successfully");
            } else {
                await createMutation.mutateAsync(payload);
                toast.success("Job criteria created successfully");
            }
            navigate("/dashboard/admin/criteria-stages/criteria");
        } catch (error) {
            const errorMessage = extractErrorMessage(error, "Failed to save criteria:")
            console.error(errorMessage);
            toast.error(errorMessage);
        }
    };
    const handleEnhance = async () => {
        const name = form.getValues("name");
        const description = form.getValues("description");

        // Clear any previous custom errors before validating
        form.clearErrors(["name", "description"]);

        const validation = enhanceJobCriteriaSchema.safeParse({ name, description });
        if (!validation.success) {
            validation.error.issues.forEach((err) => {
                const path = err.path[0] as "name" | "description";
                form.setError(path, {
                    type: "custom",
                    message: err.message,
                });
            });
            toast.error("Please fix the validation errors before enhancing.");
            return;
        }

        try {
            const enhancedDescription = await enhanceMutation.mutateAsync({ name, description: description as string });
            form.setValue("prompt_text", enhancedDescription.enhanced_prompt);
            toast.success("Prompt enhanced successfully!");
        } catch (error) {
            const errorMessage = extractErrorMessage(error, "Failed to enhance criteria:")
            console.error(errorMessage);
            toast.error(errorMessage);
        }
    };

    return (
        <AppPageShell width="wide">
            <PageHeader
                title={isEditMode ? "Edit Job Criteria" : "Create Job Criteria"}
                // subtitle={isEditMode ? "Update the configuration for this evaluation criterion." : "Define a new criterion for candidate evaluation."}
                breadcrumbActions={
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/dashboard/admin/criteria-stages/criteria")}
                        className="gap-2 h-9"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go Back
                    </Button>
                }
            />


            <Card className="border-border/50 shadow-sm">
                <CardHeader>
                    {/* <CardTitle>{isEditMode ? "Criteria Details" : "New Criteria"}</CardTitle>
                    <CardDescription>
                        Configure how this criterion will be used in the evaluation process.
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
                                        <FormLabel>Name<Required /> </FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Communication Skills" {...field} />
                                        </FormControl>
                                        {/* <FormDescription>
                                            The display name for this evaluation criterion.
                                        </FormDescription> */}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center justify-between">
                                            <FormLabel>Description<Required /></FormLabel>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleEnhance}
                                                disabled={enhanceMutation.isPending || isSubmitting}
                                                className="text-xs gap-1"
                                            >
                                                <Sparkle className={`h-3.5 w-3.5 text-violet-600 dark:text-violet-400 ${enhanceMutation.isPending ? 'animate-spin' : 'animate-pulse'}`} />
                                                {enhanceMutation.isPending ? "Enhancing..." : "Enhance with AI"}
                                            </Button>
                                        </div>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Describe what this criterion evaluates..."
                                                className="min-h-28 resize-y"
                                                {...field}
                                            ></Textarea>
                                        </FormControl>
                                        {/* <FormDescription>
                                            A detailed explanation of what the AI should look for.
                                        </FormDescription> */}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="prompt_text"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prompt Text</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Describe what this criterion evaluates..."
                                                className="min-h-28 resize-y disabled:opacity-80"
                                                {...field}
                                            // disabled
                                            />
                                        </FormControl>
                                        {/* <FormDescription>
                                            A detailed prompt of what the AI should look for.
                                        </FormDescription> */}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex items-center justify-end gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate(-1)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" isLoading={isSubmitting || enhanceMutation.isPending} className="gap-2">
                                    <Save className="h-4 w-4" />
                                    {isEditMode ? "Update Criteria" : "Create Criteria"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

        </AppPageShell>
    );
}
