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
import { ErrorDisplay, useToast } from "@/components/shared";
import { slugify } from "@/utils/slug";
import {
    adminCriteriaService,
    type CriterionRead,
} from "@/apis/admin";
import { CriteriaInfoModal } from "@/components/admin/CriteriaInfoModal";
import { DeleteModal } from "@/components/modal";
import { useAdminData, useDebouncedValue } from "@/hooks";
import { extractErrorMessage } from "@/utils/error";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Admin page for managing job evaluation criteria.
 * Displays searchable table with create, edit, toggle, and delete functionality.
 */
const AdminJobCriteria = () => {
    const [selectedCriterion, setSelectedCriterion] = useState<CriterionRead | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();

    const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebouncedValue(search);

    // Reset to first page when search changes
    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [debouncedSearch]);

    const {
        data: criteriaData,
        total,
        loading,
        error,
        fetchData: fetchCriteria,
    } = useAdminData<CriterionRead>(
        () => adminCriteriaService.getAllCriteria(pageIndex * pageSize, pageSize, debouncedSearch),
        { fetchOnMount: false }
    );

    // Refetch when pagination or search changes
    useEffect(() => {
        fetchCriteria();
    }, [pageIndex, pageSize, debouncedSearch, fetchCriteria]);

    const [overallTotal, setOverallTotal] = useState(0);
    useEffect(() => {
        if (!debouncedSearch) {
            setOverallTotal(total);
        }
    }, [total, debouncedSearch]);

    const [_deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<CriterionRead | null>(null);

    const handleDeleteClick = async (criterion: CriterionRead) => {
        try {
            setDeletingId(criterion.id);
            setDeleteError(null);
            await adminCriteriaService.deleteCriterion(criterion.id);
            fetchCriteria();
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
            .map((name) => {
                let trimmed = name.trim();
                if (
                    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
                    (trimmed.startsWith('"') && trimmed.endsWith('"'))
                ) {
                    return trimmed.slice(1, -1);
                }
                return trimmed;
            })
            .filter(Boolean);

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
                    className="hover:bg-transparent p-0 font-semibold"
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-medium text-foreground capitalize">{row.original.name}</span>
            ),
        },
        {
            id: "description",
            accessorKey: "description",
            header: () => {
                return <div className="flex items-center gap-2">
                    <span className="font-semibold">Description</span>
                </div>
            },
            cell: ({ row }) => (
                <span className="text-muted-foreground truncate line-clamp-1 max-w-sm">
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
                    className="hover:bg-transparent p-0 font-semibold"
                >
                    Created At
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <DateDisplay date={row.original.created_at} />,
        },
        {
            id: "actions",
            header: () => {
                return <div className="flex items-center justify-center gap-2">
                    <span className="font-semibold">Actions</span>
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
                                    className="h-9 w-9 rounded-xl text-blue-500 hover:bg-blue-500/10 hover:text-blue-600 transition-colors flex items-center justify-center shrink-0"
                                >
                                    <Info className="h-4 w-4 shrink-0" />
                                    <span className="sr-only">Info</span>
                                </Button>
                            )}
                        />
                        <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                            <span className="text-blue-600">View Info</span>
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
                                        className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                                    >
                                        <Edit2 className="h-4 w-4 shrink-0" />
                                        <span className="sr-only">Update</span>
                                    </Button>
                                )}
                            />
                            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                                <span className="text-primary">Edit Criteria</span>
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
                                        className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                                    >
                                        <Trash2Icon className="h-4 w-4 shrink-0" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                )}
                            />
                            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                                <span className="text-destructive">Delete Criteria</span>
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

            {error && !criteriaData ? <ErrorDisplay message={error} onRetry={fetchCriteria} /> :
                <DataTable
                    columns={columns}
                    data={criteriaData}
                    loading={loading}
                    searchKey="name"
                    searchPlaceholder="Search criteria..."
                    searchValue={search}
                    onSearchChange={setSearch}
                    initialSorting={[{ id: "created_at", desc: true }]}
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

export default AdminJobCriteria;
