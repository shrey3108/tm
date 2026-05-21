/**
 * Admin page for managing skills.
 * Displays all skills with ability to create, edit, and delete.
 */
import { useState, useEffect } from "react";
import { adminSkillService } from "@/apis/admin";
import type { SkillRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { DataTable } from "@/components/shared/DataTable";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { CreateSkillModal, DeleteModal } from "@/components/modal";
import { useAdminData, useDebouncedValue } from "@/hooks";
import { Edit2, Trash2Icon, ArrowUpDown, AlertCircle, Plus } from "lucide-react";
import { extractErrorMessage } from "@/utils/error";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS, hasPermissions } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";

const AdminSkills = () => {
  const toast = useToast();
  const user = useAppSelector(selectCurrentUser);
  const hasManagePermission = hasPermissions(user?.permissions, PERMISSIONS.SKILLS_MANAGE);
  const [showModal, setShowModal] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillRead | null>(null);

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search)

  // Reset to first page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);

  const {
    data: skills,
    total,
    loading,
    error,
    fetchData: fetchSkills,
  } = useAdminData<SkillRead>(
    () => adminSkillService.getAllSkills(pageIndex * pageSize, pageSize, debouncedSearch),
    { fetchOnMount: false }
  );

  // Refetch when pagination or search changes
  useEffect(() => {
    fetchSkills();
  }, [pageIndex, pageSize, debouncedSearch, fetchSkills]);

  const [overallTotal, setOverallTotal] = useState(0);
  useEffect(() => {
    if (!debouncedSearch) {
      setOverallTotal(total);
    }
  }, [total, debouncedSearch]);

  const [_deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SkillRead | null>(null);

  /**
   * Performs immediate deletion of a skill.
   * If failure occurs, displays reason in a modal.
   */
  const handleDeleteClick = async (skill: SkillRead) => {
    try {
      setDeletingId(skill.id);
      setDeleteError(null);
      await adminSkillService.deleteSkill(skill.id);
      fetchSkills();
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
    setSelectedSkill(null);
    setShowModal(true);
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
    // job name [a, b]
    const jobNamesStr = jobMatch[1];

    // Simple parser for comma-separated job names: [Job A, Job B]
    const jobNames = jobNamesStr
      .split(",")
      .map((name) => {
        let trimmed = name.trim();
        // remove quotes if they exist (for robustness)
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
          Please deactivate or remove this skill from these jobs before deleting.
        </p>
      </div>
    );
  };

  const handleEditClick = (skill: SkillRead) => {
    setSelectedSkill(skill);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSkill(null);
  };

  const columns: ColumnDef<SkillRead>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <div className="min-w-[200px]">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[200px] truncate ">
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: "description",
      // header: "Description",
      header: () => {
        return (
          <div className="flex items-center gap-2  max-w-[800px]">
            <span className="font-semibold">Description</span>
          </div>
        )
      },
    cell: ({ row }) => (
        <div className="flex items-center gap-2 max-w-[800px] truncate ">
          {row.original.description || "No description provided"}
        </div>
      ),
    },
    ...(hasManagePermission
      ? [
          {
            id: "actions",
            header: () => (
              <div className="flex items-center justify-center gap-2">
                <span className="font-semibold">Actions</span>
              </div>
            ),
            cell: ({ row }) => (
              <div className="gap-2 flex items-center justify-center">
                <HoverCard>
                  <HoverCardTrigger
                    render={(props) => (
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(row.original)}
                        className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                      >
                        <Edit2 className="h-4 w-4 shrink-0" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    )}
                  />
                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                    <span className="text-primary">Edit Skill</span>
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
                        className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                      >
                        <Trash2Icon className="h-4 w-4 shrink-0" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                  />
                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                    <span className="text-destructive">Delete Skill</span>
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
        <ErrorDisplay message={error} onRetry={fetchSkills} />
      ) : (
        <DataTable
          columns={columns}
          data={skills}
          loading={loading}
          searchKey="name"
          searchPlaceholder="Filter skills by name..."
          searchValue={search}
          onSearchChange={setSearch}
          initialSorting={[{ id: "name", desc: false }]}
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

      <CreateSkillModal
        show={showModal}
        handleClose={handleCloseModal}
        onSkillSaved={fetchSkills}
        skill={selectedSkill}
      />

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
};

export default AdminSkills;
