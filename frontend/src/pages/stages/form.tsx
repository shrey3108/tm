/**
 * @module AdminJobStageForm
 * @component AdminJobStageForm
 *
 * Form wizard/editor component for building and configuring job pipeline stages.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft, Search, Check } from "lucide-react";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { useWatch } from "react-hook-form";
import {
    useCreateStageTemplateMutation,
    useUpdateStageTemplateMutation,
} from "@/hooks/mutations/admin/useJobStage";
import type { StageTemplate } from "@/types/stage";
import { slugify } from "@/utils/slug";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { stageTemplateCreateSchema, type StageTemplateCreateFormValues } from "@/schemas/stageTemplate";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useJobCriteria } from "@/hooks/queries/admin/useJobCriteria";
import { useJobStage } from "@/hooks/queries/admin/useJobStage";
import { Required } from "@/components/shared/Required";


/**
 * Form page for creating or editing job stage templates.
 * Allows associating evaluation criteria with each stage.
 */
export default function AdminJobStageForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { slug } = useParams<{ slug?: string }>();
    const toast = useToast();

    const createMutation = useCreateStageTemplateMutation();
    const updateMutation = useUpdateStageTemplateMutation();
    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    const [isEditMode, setIsEditMode] = useState(false);
    const [criteriaSearch, setCriteriaSearch] = useState("");



    const form = useForm<StageTemplateCreateFormValues>({
        resolver: zodResolver(stageTemplateCreateSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            default_config: {
                criteria_ids: [],
                is_active: true,
                required_inputs: [],
            },
            is_default: false,
            default_order: 0,
        },
    });

    const defaultConfig = useWatch({
        control: form.control,
        name: "default_config",
        defaultValue: { criteria_ids: [], is_active: true, required_inputs: [] },
    });

    const selectedCriteriaIds = (defaultConfig?.criteria_ids as string[]) || [];

    const requiredInputs = useWatch({
        control: form.control,
        name: "default_config.required_inputs",
        defaultValue: [],
    }) || [];

    const { data: criteria, loading: isLoadingCriteria } = useJobCriteria(0, 100);
    const { data: stages, loading: isLoadingStages } = useJobStage(0, 100);
    const template = stages.find(t => slugify(t.name) === slug);

    useEffect(() => {
        const stateData = location.state as any;

        const initializeForm = (t: StageTemplate) => {
            const { name, description, config, is_default, default_order } = t;
            form.reset({
                name,
                description: description || "",
                default_config: {
                    criteria_ids: config?.evaluation_criteria?.flatMap((item) => {
                        const val = typeof item === "string"
                            ? item
                            : (item && typeof item === "object" && "id" in item ? (item as { id?: string | null }).id : "");
                        return val ? [val] : [];
                    }) || [],
                    is_active: config?.is_active ?? true,
                    required_inputs: config?.required_inputs || [],
                },
                is_default: is_default || false,
                default_order: default_order ?? 0,
            });
        };

        if (slug && slug !== "new") {
            setIsEditMode(true);
            if (stateData?.template) {
                initializeForm(stateData.template);
            } else if (!isLoadingStages) {
                if (template) {
                    initializeForm(template);
                } else {
                    toast.error("Stage template not found");
                    navigate("/dashboard/admin/criteria-stages/stages");
                }
            }
        }
    }, [slug, location.state, form, toast, navigate, template, isLoadingStages]);

    const toggleCriteria = (criteriaId: string) => {
        const current = [...selectedCriteriaIds];
        const index = current.indexOf(criteriaId);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(criteriaId);
        }

        form.setValue("default_config", {
            ...defaultConfig,
            criteria_ids: current
        }, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        });
    };

    const handleRequirementToggle = (value: "resume" | "transcript" | "question" | "github", checked: boolean) => {
        const current = [...requiredInputs];
        if (checked) {
            if (!current.includes(value)) {
                current.push(value);
            }
        } else {
            const index = current.indexOf(value);
            if (index > -1) {
                current.splice(index, 1);
            }
        }

        form.setValue("default_config.required_inputs", current, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        });
    };

    const filteredCriteria = useMemo(() => {
        const query = criteriaSearch.toLowerCase();
        const matched = criteria.filter((c) =>
            c.name.toLowerCase().includes(query)
        );
        const selected = matched.filter((c) => selectedCriteriaIds.includes(c.id));
        const nonSelected = matched.filter((c) => !selectedCriteriaIds.includes(c.id));
        return [...selected, ...nonSelected];
    }, [criteria, criteriaSearch, selectedCriteriaIds]);

    const selectedCriteriaData = useMemo(() => {
        return criteria.filter((c) =>
            selectedCriteriaIds.includes(c.id)
        );
    }, [criteria, selectedCriteriaIds]);

    const onSubmit = async (values: StageTemplateCreateFormValues) => {
        try {
            if (isEditMode) {
                if (template) {
                    await updateMutation.mutateAsync({ id: template.id, data: values as any });
                    toast.success("Stage template updated successfully");
                } else {
                    throw new Error("Template not found for update");
                }
            } else {
                await createMutation.mutateAsync(values as any);
                toast.success("Stage template created successfully");
            }
            navigate("/dashboard/admin/criteria-stages/stages");
        } catch (error) {
            console.error("Failed to save stage template:", error);
            toast.error("Failed to save stage template");
        }
    };

    return (
        <AppPageShell width="wide">
            <PageHeader
                title={isEditMode ? "Edit Job Stage" : "Create Job Stage"}
                // subtitle={isEditMode ? "Update the configuration for this recruitment stage." : "Define a new recruitment stage template."}
                breadcrumbActions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/dashboard/admin/criteria-stages/stages")}

                        className="gap-2 h-9"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go Back
                    </Button>
                }
            />

            <Card className="border-border/50 shadow-sm">
                <CardHeader>
                    {/* <CardTitle className="font-sans">{isEditMode ? "Stage Details" : "New Stage"}</CardTitle> */}
                    {/* <CardDescription>
                        Configure stage parameters and associated evaluation criteria.
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
                                            <Input placeholder="e.g. Technical Interview" {...field} />
                                        </FormControl>
                                        {/* <FormDescription>
                                            The display name for this stage.
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
                                        <FormLabel>Description<Required /></FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Describe the purpose of this stage..."
                                                className="min-h-30 resize-y"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        {/* <FormDescription>
                                            A detailed explanation of what happens in this stage.
                                        </FormDescription> */}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-2">
                                <FormField
                                    control={form.control}
                                    name="default_config.is_active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>Active Status</FormLabel>
                                                {/* <FormDescription>
                                                Indicate if this stage is currently enabled for use.
                                            </FormDescription> */}
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

                                <FormField
                                    control={form.control}
                                    name="is_default"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>Default Stage</FormLabel>
                                                {/* <FormDescription>
                                                Indicate if this stage should be automatically added to new jobs.
                                            </FormDescription> */}
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
                            </div>
                            <FormField
                                control={form.control}
                                name="default_order"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Order <Required /></FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="e.g. 0"
                                                {...field}
                                                value={field.value ?? ""}
                                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                                            />
                                        </FormControl>
                                        {/* <FormDescription>
                                            The default position of this stage in a new pipeline.
                                        </FormDescription> */}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4 pt-4 border-t">
                                <div className="space-y-0.5">
                                    <FormLabel>Stage Requirements <Required /></FormLabel>
                                    {form.formState.errors.default_config?.required_inputs && (
                                        <p className="text-destructive text-sm font-medium">
                                            {form.formState.errors.default_config.required_inputs.message}
                                        </p>
                                    )}
                                    {/* <FormDescription>
                                        Select the required inputs/actions candidate must complete during this stage.
                                    </FormDescription> */}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                        {
                                            id: "resume",
                                            label: "Resume",
                                            description: "Requires candidate's resume analysis",
                                        },
                                        {
                                            id: "transcript",
                                            label: "Transcript",
                                            description: "Requires uploading interview transcript",
                                        },
                                        {
                                            id: "question",
                                            label: "Technical Questions",
                                            description: "Requires assigning technical questions/papers",
                                        },
                                        {
                                            id: "github",
                                            label: "GitHub Repository",
                                            description: "Requires candidate's GitHub URL submission",
                                        },
                                    ].map((item) => {
                                        const isChecked = requiredInputs.includes(item.id as any);
                                        return (
                                            <div
                                                key={item.id}
                                                className={cn(
                                                    "flex items-center space-x-1.5 space-y-0 rounded-xl border p-2 shadow-sm transition-all hover:bg-muted/5",
                                                    isChecked ? "border-primary bg-primary/5" : "border-border"
                                                )}
                                            >
                                                <Checkbox
                                                    id={`req-${item.id}`}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) =>
                                                        handleRequirementToggle(item.id as any, !!checked)
                                                    }
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <label
                                                        htmlFor={`req-${item.id}`}
                                                        className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {item.label}
                                                        <p className="text-xs font-normal text-muted-foreground">
                                                            {item.description}
                                                        </p>
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <div className="space-y-2">
                                    <FormLabel className=" flex items-center justify-between">
                                        <span>Associated Criteria <Required /></span>
                                        {selectedCriteriaData.length > 0 ? <span className="text-primary text-sm font-bold">
                                            Selected Criteria ({selectedCriteriaData.length})
                                        </span> : null}
                                    </FormLabel>
                                    {form.formState.errors.default_config?.criteria_ids && (
                                        <p className="text-destructive text-sm font-medium">
                                            {form.formState.errors.default_config.criteria_ids.message}
                                        </p>
                                    )}
                                    {/* <FormDescription className="flex items-center justify-between">
                                        <span>Select the evaluation criteria to use for this stage.</span>
                                        {selectedCriteriaData.length > 0 ? <span className="text-primary text-sm font-bold">
                                            Selected Criteria ({selectedCriteriaData.length})
                                        </span> : null}
                                    </FormDescription> */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search criteria..."
                                            value={criteriaSearch}
                                            onChange={(e) => setCriteriaSearch(e.target.value)}
                                            className="pl-10 h-11 text-base rounded-xl border-muted-foreground/20"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-75 overflow-y-auto p-2 border rounded-xl bg-background/50">
                                    {isLoadingCriteria ? (
                                        <div className="col-span-full py-8 text-center text-muted-foreground italic">
                                            Loading available criteria...
                                        </div>
                                    ) : filteredCriteria.length > 0 ? (
                                        filteredCriteria.map((c) => {
                                            const isSelected = selectedCriteriaIds.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => toggleCriteria(c.id)}
                                                    className={cn(
                                                        "flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all duration-300 text-left",
                                                        isSelected
                                                            ? "bg-primary/10 border-primary text-primary"
                                                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                                    )}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm">{c.name}</span>
                                                        <span className="text-xs opacity-70 line-clamp-1">{c.description}</span>
                                                    </div>
                                                    <div className={cn(
                                                        "shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all",
                                                        isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border"
                                                    )}>
                                                        {isSelected && <Check className="h-3 w-3 stroke-[3px]" />}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-full py-8 text-center text-muted-foreground italic">
                                            No criteria match your search.
                                        </div>
                                    )}
                                </div>

                                {/* {selectedCriteriaData.length > 0 && (
                                    <div className="pt-4">
                                        <p className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                                            Selected Criteria ({selectedCriteriaData.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedCriteriaData.map((c) => (
                                                <Badge
                                                    key={c.id}
                                                    variant="secondary"
                                                    className="pl-3 pr-1 py-1 text-sm rounded-xl bg-primary/10 text-primary border-primary/20 font-bold"
                                                >
                                                    {c.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCriteria(c.id)}
                                                        className="ml-2 hover:bg-primary/20 rounded-full p-1"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )} */}
                            </div>

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
                                    {isEditMode ? "Update Stage" : "Create Stage"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </AppPageShell>
    );
}
