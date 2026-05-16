import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, ArrowLeft, Search, Check, X } from "lucide-react";
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
    Switch,
    Badge,
} from "@/components";
import { useWatch } from "react-hook-form";
import { adminStageTemplateService } from "@/apis/admin/stageTemplate";
import { adminCriteriaService } from "@/apis/admin/criteria";
import type { CriterionRead } from "@/types/admin";
import type { StageTemplate } from "@/types/stage";
import { slugify } from "@/utils/slug";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/shared/ToastProvider";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { stageTemplateCreateSchema, type StageTemplateCreateFormValues } from "@/schemas/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


/**
 * Form page for creating or editing job stage templates.
 * Allows associating evaluation criteria with each stage.
 */
export default function AdminJobStageForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { slug } = useParams<{ slug?: string }>();
    const toast = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [criteriaSearch, setCriteriaSearch] = useState("");
    const [criteria, setCriteria] = useState<CriterionRead[]>([]);
    const [isLoadingCriteria, setIsLoadingCriteria] = useState(true);

    const form = useForm<StageTemplateCreateFormValues>({
        resolver: zodResolver(stageTemplateCreateSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            default_config: {
                criteria_ids: [],
                is_active: true
            },
            is_default: false,
            default_order: 0,
        },
    });

    const defaultConfig = useWatch({
        control: form.control,
        name: "default_config",
        defaultValue: { criteria_ids: [], is_active: true },
    });

    const selectedCriteriaIds = (defaultConfig?.criteria_ids as string[]) || [];

    useEffect(() => {
        const fetchCriteria = async () => {
            try {
                const data = await adminCriteriaService.getAllCriteria();
                setCriteria(data.data);

            } catch (error) {
                console.error("Failed to fetch criteria:", error);
                toast.error("Failed to load evaluation criteria");
            } finally {
                setIsLoadingCriteria(false);
            }
        };
        fetchCriteria();
    }, [toast]);

    useEffect(() => {
        const stateData = location.state as any;

        const initializeForm = (template: StageTemplate) => {
            const { name, description, config, is_default, default_order } = template;
            form.reset({
                name,
                description: description || "",
                default_config: {
                    criteria_ids: config?.evaluation_criteria.map(({ id }) => id) || [],
                    // is_active: config?.evaluation_criteria.is_active ?? true
                },
                is_default: is_default || false,
                default_order: default_order ?? 0,
            });
        };

        if (slug && slug !== "new") {
            setIsEditMode(true);
            if (stateData?.template) {
                initializeForm(stateData.template);
            } else {
                // Fetch template by searching all templates (since we only have slug)
                const fetchTemplate = async () => {
                    try {
                        const templates = await adminStageTemplateService.getAllTemplates();
                        const template = templates.data.find(t => slugify(t.name) === slug);
                        if (template) {
                            initializeForm(template);
                        } else {
                            toast.error("Stage template not found");
                            navigate("/dashboard/admin/criteria-stages/stages");
                        }
                    } catch (error) {
                        console.error("Failed to fetch stage details:", error);
                        toast.error("Failed to load stage details");
                    }
                };
                fetchTemplate();
            }
        }
    }, [slug, location.state, form, toast, navigate]);

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

    const filteredCriteria = criteria.filter((c) =>
        c.name.toLowerCase().includes(criteriaSearch.toLowerCase())
    );

    const selectedCriteriaData = criteria.filter((c) =>
        selectedCriteriaIds.includes(c.id)
    );

    const onSubmit = async (values: StageTemplateCreateFormValues) => {
        setIsSubmitting(true);
        try {
            if (isEditMode) {
                const templates = await adminStageTemplateService.getAllTemplates();
                const template = templates.data.find(t => slugify(t.name) === slug);
                if (template) {
                    await adminStageTemplateService.updateTemplate(template.id, values as any);
                    toast.success("Stage template updated successfully");
                } else {
                    throw new Error("Template not found for update");
                }
            } else {
                await adminStageTemplateService.createTemplate(values as any);
                toast.success("Stage template created successfully");
            }
            navigate("/dashboard/admin/criteria-stages/stages");
        } catch (error) {
            console.error("Failed to save stage template:", error);
            toast.error("Failed to save stage template");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppPageShell width="wide" className="animate-in fade-in duration-500">
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
                    <CardTitle className="font-sans">{isEditMode ? "Stage Details" : "New Stage"}</CardTitle>
                    <CardDescription>
                        Configure stage parameters and associated evaluation criteria.
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
                                            <Input placeholder="e.g. Technical Interview" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            The display name for this stage.
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
                                                placeholder="Describe the purpose of this stage..."
                                                className="min-h-[120px] resize-y"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            A detailed explanation of what happens in this stage.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="default_config.is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base font-bold">Active Status</FormLabel>
                                            <FormDescription>
                                                Indicate if this stage is currently enabled for use.
                                            </FormDescription>
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
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base font-bold">Default Stage</FormLabel>
                                            <FormDescription>
                                                Indicate if this stage should be automatically added to new jobs.
                                            </FormDescription>
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
                                name="default_order"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Default Order</FormLabel>
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
                                        <FormDescription>
                                            The default position of this stage in a new pipeline.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4 pt-4 border-t">
                                <div className="space-y-2">
                                    <FormLabel className="text-lg font-bold">Associated Criteria</FormLabel>
                                    <FormDescription>
                                        Select the evaluation criteria to use for this stage.
                                    </FormDescription>
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2 border rounded-xl bg-background/50">
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

                                {selectedCriteriaData.length > 0 && (
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
                                )}
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
