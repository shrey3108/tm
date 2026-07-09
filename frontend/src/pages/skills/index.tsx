/**
 * @module AdminSkills
 * @component AdminSkills
 *
 * Admin page for managing skills.
 * Displays all skills with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import type { SkillRead } from "@/types/skill";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { Edit2, Trash2Icon, ArrowUpDown, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS, hasPermissions } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useSkill } from "@/hooks/queries/admin/useSkill";
import { useDeleteSkillMutation } from "@/hooks/mutations/admin/useSkill";
import { usePageFilters } from "@/hooks/usePageFilters";
import DeleteModal from "@/components/modal/DeleteModal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

export default function AdminSkills() {
  const toast = useToast();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const hasManagePermission = hasPermissions(user?.permissions, PERMISSIONS.SKILLS_MANAGE);
  const deleteSkillMutation = useDeleteSkillMutation();

  const { filters, setFilters } = usePageFilters("adminSkills", {
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

  const [, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SkillRead | null>(null);
  const [overallTotal, setOverallTotal] = useState(0);

  const handleSearchChange = (value: string) => {
    setFilters({
      search: value,
      pageIndex: 0,
    });
  };

  const debouncedSearch = useDebouncedValue(search);
  const { data: skills, total, loading, error, refetch } = useSkill({ skip: pageIndex * pageSize, limit: pageSize, q: debouncedSearch });

  useEffect(() => {
    if (!debouncedSearch && total !== overallTotal) {
      queueMicrotask(() => {
        setOverallTotal(total);
      });
    }
  }, [total, debouncedSearch, overallTotal]);

  /**
   * Performs immediate deletion of a skill.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (skill: SkillRead) => {
    try {
      setDeletingId(skill.id);
      setDeleteError(null);
      await deleteSkillMutation.mutateAsync(skill.id);
      toast.success("Skill deleted successfully");
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setDeleteError(errMsg);
      setItemToDelete(skill);
      setShowDeleteModal(true);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateClick = () => {
    navigate("/dashboard/admin/skills/new");
  };

  /**
   * Parses the backend error message to extract job names if the skill is in use.
   */
  const renderFormattedError = (error: string | null) => {
    if (!error) return null;

    // Get job names
    const jobMatch = error.match(/ACTIVE Job\(s\): \[(.*?)\]/);
    if (!jobMatch) return error;

    // Get skill delete main message
    const mainMessage = error.split(/active job\(s\):/i)[0].trim();
    const jobNamesStr = jobMatch[1];

    const jobNames = jobNamesStr
      .split(",")
      .flatMap((name) => {
        const trimmed = name.trim();
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
          Please deactivate or remove this skill from these jobs before deleting.
        </p>
      </div>
    );
  };

  const handleEditClick = (skill: SkillRead) => {
    navigate(`/dashboard/admin/skills/${slugify(skill.name)}/edit`, { state: { skill } });
  };

  const columns: ColumnDef<SkillRead>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <div className="max-w-50">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Name
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-50 truncate ">
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: () => {
        return (
          <div className="flex items-center gap-2  max-w-150">
            <span>Description</span>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2 max-w-150 truncate ">
          {row.original.description || "No description provided"}
        </div>
      ),
    },
    {
      accessorKey: "default_weightage",
      header: () => {
        return (
          <div className="flex items-center justify-center gap-2">
            <span>Weightage</span>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2 max-w-37.5 font-medium text-foreground">
          {row.original.default_weightage ?? 10}
        </div>
      ),
    },
    ...(hasManagePermission
      ? [
        {
          id: "actions",
          header: () => (
            <div className="flex items-center justify-center gap-2">
              <span>Actions</span>
            </div>
          ),
          cell: ({ row }) => (
            <div className="flex items-center justify-center gap-0.5">
              <HoverCard>
                <HoverCardTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(row.original)}
                      className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                    >
                      <Edit2 className="h-4 w-4 shrink-0" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  )}
                />
                <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                  Edit Skill
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
                    >
                      <Trash2Icon className="h-4 w-4 shrink-0" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
                />
                <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                  Delete Skill
                </HoverCardContent>
              </HoverCard>
            </div>
          ),
        } as ColumnDef<SkillRead>,
      ]
      : []),
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Skill Management"
        breadcrumbActions={
          <PermissionGuard permissions={PERMISSIONS.SKILLS_MANAGE} hideWhenDenied>
            <Button onClick={handleCreateClick} size={"sm"} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Skill
            </Button>
          </PermissionGuard>
        }
      />

      {error && !skills.length ? (
        <ErrorDisplay message={error.message} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={skills}
          loading={loading}
          searchKey="name"
          searchPlaceholder="Filter skills by name..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          isServerSide={true}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={Math.ceil(total / pageSize)}
          onPaginationChange={setPagination}
          totalRecords={total}
          totalCount={overallTotal}
          resultCount={skills.length}
          entityName="Skills"
        />
      )}

      <DeleteModal
        show={showDeleteModal}
        handleClose={() => setShowDeleteModal(false)}
        handleConfirm={() => { }} // Not used as we delete before opening modal
        title="Delete Skill Error"
        message={itemToDelete ? `Unable to delete skill "${itemToDelete.name}"` : ""}
        isLoading={false}
        error={renderFormattedError(deleteError)}
        showFooterButtons={false}
      />
    </AppPageShell>
  );
}
