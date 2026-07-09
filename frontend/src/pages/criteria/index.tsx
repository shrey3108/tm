/**
 * @module AdminJobCriteria
 * @component AdminJobCriteria
 *
 * Admin view for listing, managing, and creating evaluation criteria for jobs.
 */
import { useState, useEffect } from "react";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { DateDisplay } from "@/components/shared/DateDisplay";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { ArrowUpDown, Edit2, Trash2Icon, Plus, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useNavigate } from "react-router-dom";

import { slugify } from "@/utils/slug";

import { CriteriaInfoModal } from "@/components/admin/CriteriaInfoModal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { extractErrorMessage } from "@/utils/error";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { useJobCriteria } from "@/hooks/queries/admin/useJobCriteria";
import { useDeleteCriterionMutation } from "@/hooks/mutations/admin/useJobCriteria";
import { usePageFilters } from "@/hooks/usePageFilters";
import type { CriterionRead } from "@/types/jobCriteria";
import DeleteModal from "@/components/modal/DeleteModal";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { useToast } from "@/components/shared/ToastProvider";

/**
 * Admin page for managing job evaluation criteria.
 * Displays searchable table with create, edit, toggle, and delete functionality.
 */
export default function AdminJobCriteria() {
    const [selectedCriterion, setSelectedCriterion] = useState<CriterionRead | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    const { filters, setFilters } = usePageFilters("adminJobCriteria", {
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

    const [_deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<CriterionRead | null>(null);
    const [overallTotal, setOverallTotal] = useState(0);

    const debouncedSearch = useDebouncedValue(search);

    const deleteCriterionMutation = useDeleteCriterionMutation();

    const { data: criteriaData, total, loading, error, refetch } = useJobCriteria(pageIndex * pageSize, pageSize, debouncedSearch)


    useEffect(() => {
        if (!debouncedSearch && overallTotal !== total) {
            queueMicrotask(() => {
                setOverallTotal(total);
            })
        }
    }, [total, debouncedSearch, overallTotal]);
    const handleSearchChange = (value: string) => {
        setFilters({
            search: value,
            pageIndex: 0,
        });
    };


    const handleDeleteClick = async (criterion: CriterionRead) => {
        try {
            setDeletingId(criterion.id);
            setDeleteError(null);
            await deleteCriterionMutation.mutateAsync(criterion.id);
            toast.success("Criteria deleted successfully");
        } catch (err) {
            const errMsg = extractErrorMessage(err);
            setDeleteError(errMsg);
            setItemToDelete(criterion);
            setShowDeleteModal(true);
        } finally {
            setDeletingId(null);
        }
    };

    /**
     * Parses the backend error message to extract job names if the criteria is in use.
     */
    const renderFormattedError = (error: string | null) => {
        if (!error) return null;

        // Get job names
        const jobMatch = error.match(/ACTIVE Job\(s\): \[(.*?)\]/);
        if (!jobMatch) return error;

        // Get criteria delete main message
        const mainMessage = error.split(/active job\(s\):/i)[0].trim();
        const jobNamesStr = jobMatch[1];

        const jobNames = jobNamesStr
            .split(",")
            .flatMap((name) => {
                let trimmed = name.trim();
                const val =
                    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
                        (trimmed.startsWith('"') && trimmed.endsWith('"'))
                        ? trimmed.slice(1, -1)
                        : trimmed;
                return val ? [val] : [];
            });

        return (
            <div className="space-y-3 font-medium">
                <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-sm font-semibold">{mainMessage}</p>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                    {jobNames.map((job, idx) => (
                        <Badge key={idx} variant="outline" className="border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors">
                            {job}
                        </Badge>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground pl-6 italic">
                    Please deactivate or remove this criteria from these jobs before deleting.
                </p>
            </div>
        );
    };


    const handleUpdate = (data: CriterionRead) => {
        const slug = slugify(data.name);
        navigate(`/dashboard/admin/criteria-stages/criteria/${slug}/edit`, {
            state: { criteria: data, id: data.id }
        });
    };

    const handleOpenInfo = (data: CriterionRead) => {
        setSelectedCriterion(data);
        setIsInfoModalOpen(true);
    };

    const columns: ColumnDef<CriterionRead>[] = [
        {
            id: "name",
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
                <span className="text-foreground capitalize">{row.original.name}</span>
            ),
        },
        {
            id: "description",
            accessorKey: "description",
            header: () => {
                return <div className="flex items-center gap-2">
                    <span className="text-base">Description</span>
                </div>
            },
            cell: ({ row }) => (
                <span className="truncate line-clamp-1 max-w-sm">
                    {row.original.description || "No description"}
                </span>
            ),
        },
        {
            accessorKey: "created_at",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent p-0 font-semibold text-base"
                >
                    Created At
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <DateDisplay date={row.original.created_at} />,
        },
        {
            id: "actions",
            header: () => {
                return <div className="flex items-center justify-center gap-2">
                    <span className="text-base">Actions</span>
                </div>
            },
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2 ">
                    <HoverCard>
                        <HoverCardTrigger
                            render={(props) => (
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenInfo(row.original)}
                                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                >
                                    <Info className="h-4 w-4 shrink-0" />
                                    <span className="sr-only">Info</span>
                                </Button>
                            )}
                        />
                        <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                            View Info
                        </HoverCardContent>
                    </HoverCard>

                    <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                        <HoverCard>
                            <HoverCardTrigger
                                render={(props) => (
                                    <Button
                                        {...props}
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleUpdate(row.original)}
                                        className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                    >
                                        <Edit2 className="h-4 w-4 shrink-0" />
                                        <span className="sr-only">Update</span>
                                    </Button>
                                )}
                            />
                            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                                Edit Criteria
                            </HoverCardContent>
                        </HoverCard>
                    </PermissionGuard>

                    <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                        <HoverCard>
                            <HoverCardTrigger
                                render={(props) => (
                                    <Button
                                        {...props}
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteClick(row.original)}
                                        className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                    >
                                        <Trash2Icon className="h-4 w-4 shrink-0" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                )}
                            />
                            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                                Delete Criteria
                            </HoverCardContent>
                        </HoverCard>
                    </PermissionGuard>
                </div>
            ),
        },
    ];

    return (
        <AppPageShell width="wide">
            <PageHeader
                title="Job Criteria Configuration"
                breadcrumbActions={
                    <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
                        <Button
                            onClick={() => navigate("/dashboard/admin/criteria-stages/criteria/new")}
                            // className="gap-2"
                            size={"sm"}
                        >
                            <Plus className="h-4 w-4" />
                            Add Criteria
                        </Button>
                    </PermissionGuard>
                }
            />

            {error && !criteriaData ? <ErrorDisplay message={error.message} onRetry={refetch} /> :
                <DataTable
                    columns={columns}
                    data={criteriaData}
                    loading={loading}
                    searchKey="name"
                    searchPlaceholder="Search criteria..."
                    searchValue={search}
                    onSearchChange={handleSearchChange}

                    isServerSide={true}
                    pageIndex={pageIndex}
                    pageSize={pageSize}
                    pageCount={Math.ceil(total / pageSize)}
                    onPaginationChange={setPagination}
                    totalRecords={total}
                    totalCount={overallTotal}
                    resultCount={criteriaData.length}
                    entityName="Criteria"
                />}


            <CriteriaInfoModal
                criterion={selectedCriterion}
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
            />

            <DeleteModal
                show={showDeleteModal}
                handleClose={() => setShowDeleteModal(false)}
                handleConfirm={() => { }}
                title="Delete Criteria Error"
                message={itemToDelete ? `Unable to delete criteria "${itemToDelete.name}"` : ""}
                isLoading={false}
                error={renderFormattedError(deleteError)}
                showFooterButtons={false}
            />
        </AppPageShell>
    );
};
