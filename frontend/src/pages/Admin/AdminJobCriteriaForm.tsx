import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft } from "lucide-react";
import {
    Button,
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
    Textarea,
} from "@/components";
import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { jobCriteriaCreateSchema, type JobCriteriaCreateFormValues } from "@/schemas/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminCriteriaService } from "@/apis/admin";

/**
 * Form page for creating or editing job evaluation criteria.
 * Includes job selection (apply to all or specific jobs) and optional filter by tags.
 */
export default function AdminJobCriteriaForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { slug } = useParams<{ slug?: string }>();
    const toast = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const form = useForm<JobCriteriaCreateFormValues>({
        resolver: zodResolver(jobCriteriaCreateSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            is_active: true,
            apply_to_all: true,
            job_ids: [],
        },
    });


    useEffect(() => {
        const fetchDetails = async (id: string) => {
            try {
                const criteria = await adminCriteriaService.getCriterionById(id);
                form.reset({
                    name: criteria.name,
                    description: criteria.prompt_text || criteria.description || "",
                    is_active: true, // Placeholder as backend doesn't have it
                    apply_to_all: true,
                    job_ids: [],
                });
            } catch (error) {
                console.error("Failed to fetch criteria details:", error);
                toast.error("Failed to load criteria details");
            }
        };

        const stateData = location.state as any;

        if (slug && slug !== "new") {
            setIsEditMode(true);
            if (stateData?.criteria) {
                const criteria = stateData.criteria;
                form.reset({
                    name: criteria.name,
                    description: criteria.prompt_text || criteria.description || "",
                    is_active: true,
                    apply_to_all: true,
                    job_ids: [],
                });
            } else if (stateData?.id) {
                fetchDetails(stateData.id);
            }
        }
    }, [slug, location.state, form, toast]);

    const onSubmit = async (values: JobCriteriaCreateFormValues) => {
        setIsSubmitting(true);
        try {
            const payload = {
                name: values.name,
                description: values.description,
                prompt_text: values.description, // Mapping description to prompt_text as well
            };

            if (isEditMode) {
                const id = (location.state as any)?.id;
                if (!id) throw new Error("Missing criteria ID for update");
                await adminCriteriaService.updateCriterion(id, payload);
                toast.success("Job criteria updated successfully");
            } else {
                await adminCriteriaService.createCriterion(payload);
                toast.success("Job criteria created successfully");
            }
            navigate("/dashboard/admin/criteria-stages/criteria");
        } catch (error) {
            console.error("Failed to save criteria:", error);
            toast.error("Failed to save job criteria");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppPageShell width="wide" className="animate-in fade-in duration-500">
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
                    <CardTitle>{isEditMode ? "Criteria Details" : "New Criteria"}</CardTitle>
                    <CardDescription>
                        Configure how this criterion will be used in the evaluation process.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Communication Skills" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            The display name for this evaluation criterion.
                                        </FormDescription>
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
                                                placeholder="Describe what this criterion evaluates..."
                                                className="min-h-[220px] resize-y"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            A detailed explanation of what the AI should look for.
                                        </FormDescription>
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
                                <Button type="submit" isLoading={isSubmitting} className="gap-2">
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
