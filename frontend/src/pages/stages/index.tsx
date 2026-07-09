/**
 * @module AdminJobStages
 * @component AdminJobStages
 *
 * Admin management interface for viewing and managing stages of a job posting.
 */
import { useState, useEffect } from "react";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Info, Edit2, Trash2, ArrowUpDown, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { StageTemplate } from "@/types/stage";
import { StageDeleteDialog } from "@/components/admin/StageDeleteDialog";
import { StageDetailDialog } from "@/components/admin/StageDetailDialog";
import { useNavigate } from "react-router-dom";
import {
    useUpdateStageTemplateMutation,
    useDeleteStageTemplateMutation,
} from "@/hooks/mutations/admin/useJobStage";
import { slugify } from "@/utils/slug";
import type { PaginationState } from "@tanstack/react-table";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Switch } from "@/components/ui/switch"
import { extractErrorMessage } from "@/utils/error";
import { useJobStage } from "@/hooks/queries/admin/useJobStage";
import { usePageFilters } from "@/hooks/usePageFilters";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { useToast } from "@/components/shared/ToastProvider";
import { useDebouncedValue } from "@/hooks/useDebounced";

/**
 * Admin page for managing job stage templates.
 * Displays searchable table with view, edit, and delete functionality.
 */
export default function AdminJobStages() {
    const toast = useToast();
    const navigate = useNavigate();

    const { filters, setFilters } = usePageFilters("adminJobStages", {
        pageIndex: 0,
        pageSize: 10,
        search: "",
    });
    const { pageIndex, pageSize, search } = filters;

    const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
        const currentPagination = { pageIndex: filters.pageIndex, pageSize: filters.pageSize };
        const nextPagination = typeof val === "function" ? val(currentPagination) : val;
        setFilters({
            pageIndex: nextPagination.pageIndex,
            pageSize: nextPagination.pageSize,
        });
    };

    const [selectedTemplate, setSelectedTemplate] = useState<StageTemplate | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [overallTotal, setOverallTotal] = useState(0);

    const debouncedSearch = useDebouncedValue(search, 500);

    const updateStageMutation = useUpdateStageTemplateMutation();
    const deleteStageMutation = useDeleteStageTemplateMutation();

    const { data, total, loading, refetch, error } = useJobStage(pageIndex * pageSize, pageSize, debouncedSearch);

    const handleSearchChange = (value: string) => {
        setFilters({
            search: value,
            pageIndex: 0,
        });
    };


    useEffect(() => {
        if (!debouncedSearch && overallTotal !== total) {
            queueMicrotask(() => {
                setOverallTotal(total);
            })
        }
    }, [total, debouncedSearch, overallTotal]);

    const handleShow = (template: StageTemplate) => {
        setSelectedTemplate(template);
        setIsDetailOpen(true);
    };

    const handleEdit = (template: StageTemplate) => {
        const slug = slugify(template.name);
        navigate(`/dashboard/admin/criteria-stages/stages/${slug}/edit`, {
            state: { template }
        });
    };

    const handleDefaultToggle = async (template: StageTemplate, isChecked: boolean) => {
        try {
            await updateStageMutation.mutateAsync({ id: template.id, data: { is_default: isChecked } });
            toast.success("Stage template updated successfully");
        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            toast.error(errorMessage || "Failed to update stage template");
        }
    };

    const handleDeleteClick = (template: StageTemplate) => {
        setSelectedTemplate(template);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedTemplate) return;

        try {
            await deleteStageMutation.mutateAsync(selectedTemplate.id);
            toast.success("Stage template deleted successfully");
        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            toast.error(errorMessage || "Failed to delete stage template");
        } finally {
            setIsDeleteOpen(false);
            setSelectedTemplate(null);
        }
    };

    const columns: ColumnDef<StageTemplate>[] = [
        {
            accessorKey: "default_order",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent p-0 font-semibold text-base"
                >
                    Order
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    {row.original.default_order ?? "N|A"}
                </div>
            ),
            sortingFn: (rowA, rowB) => {
                const orderA = rowA.original.default_order ?? 0;
                const orderB = rowB.original.default_order ?? 0;
                return orderA - orderB;
            },
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent p-0 font-semibold text-base"
                >
                    Name
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="capitalize">{row.original.name}</span>
            ),
        },
        {
            accessorKey: "description",
            header: () => {
                return <div className="flex items-center gap-2">
                    <span className="text-base">Description</span>
                </div>
            },
            cell: ({ row }) => (
                <span className="truncate line-clamp-1 max-w-sm capitalize">
                    {row.original.description || "No description"}
                </span>
            ),
        },
        {
            accessorKey: "is_default",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent p-0 font-semibold text-base"
                >
                    Default Stage
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    <Switch
                        checked={row.original.is_default ?? false}
                        onCheckedChange={(isChecked) => handleDefaultToggle(row.original, isChecked)}
                        size="sm"
                        disabled={row.original.name === "Resume Screening"}
                    />
                </div>
            ),
        },
        {
            accessorKey: "required_inputs",
            header: () => (
                <div className="flex items-center justify-center gap-2">
                    <span>Criteria</span>
                </div>
            ),
            cell: ({ row }) => {
                const requiredInputs = row.original.config?.required_inputs || [];
                return (
                    <span className="truncate line-clamp-1 max-w-sm capitalize">
                        {requiredInputs.length > 0 ? requiredInputs.join(", ") : "No criteria"}
                    </span>
                );
            },
        },
        {
            id: "actions",
            header: () => {
                return <div className="flex items-center justify-center gap-2">
                    <span className="text-base">Actions</span>
                </div>
            },
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-0.5">
                    <HoverCard>
                        <HoverCardTrigger
                            render={(props) => (
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleShow(row.original)}
                                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                >
                                    <Info className="h-4 w-4 shrink-0" />
                                    <span className="sr-only">Show</span>
                                </Button>
                            )}
                        />
                        <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                            View Info
                        </HoverCardContent>
                    </HoverCard>

                    <HoverCard>
                        <HoverCardTrigger
                            render={(props) => (
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(row.original)}
                                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                    disabled={row.original.name === "Resume Screening"}
                                >
                                    <Edit2 className="h-4 w-4 shrink-0" />
                                    <span className="sr-only">Edit</span>
                                </Button>
                            )}
                        />
                        <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                            Edit Stage
                        </HoverCardContent>
                    </HoverCard>

                    <HoverCard>
                        <HoverCardTrigger
                            render={(props) => (
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClick(row.original)}
                                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                    disabled={row.original.name === "Resume Screening"}
                                >
                                    <Trash2 className="h-4 w-4 shrink-0" />
                                    <span className="sr-only">Delete</span>
                                </Button>
                            )}
                        />
                        <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                            Delete Stage
                        </HoverCardContent>
                    </HoverCard>
                </div>
            ),
        },
    ];

    return (
        <AppPageShell width="wide">
            <PageHeader
                title="Job Stages Configuration"
                breadcrumbActions={
                    <Button
                        onClick={() => navigate("/dashboard/admin/criteria-stages/stages/new")}
                        size={"sm"}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Stage
                    </Button>
                }
            />
            {error && !data ? <ErrorDisplay message={error.message} onRetry={refetch} /> :
                <DataTable
                    columns={columns}
                    data={data}
                    loading={loading}
                    searchKey="name"
                    searchValue={search}
                    onSearchChange={handleSearchChange}
                    searchPlaceholder="Search templates..."
                    isServerSide={true}
                    initialSorting={[{ id: "default_order", desc: false }]}
                    pageIndex={pageIndex}
                    pageSize={pageSize}
                    pageCount={Math.ceil(total / pageSize)}
                    onPaginationChange={setPagination}
                    totalRecords={total}
                    totalCount={overallTotal}
                    resultCount={data.length}
                    entityName="Templates"
                />
            }

            <StageDetailDialog
                isOpen={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                template={selectedTemplate}
            />

            <StageDeleteDialog
                isOpen={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                template={selectedTemplate}
                onConfirm={confirmDelete}
                onCancel={() => setIsDeleteOpen(false)}
            />
        </AppPageShell>
    );
};