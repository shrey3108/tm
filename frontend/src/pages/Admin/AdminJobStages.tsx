import { useState, useEffect } from "react";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Info, Pencil, Trash2, ArrowUpDown, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { StageTemplate } from "@/types/stage";
import { adminStageTemplateService } from "@/apis/admin/stageTemplate";
import { useToast } from "@/components/shared";
import { StageDeleteDialog } from "@/components/admin/StageDeleteDialog";
import { StageDetailDialog } from "@/components/admin/StageDetailDialog";
import { useAdminData, useDebouncedValue } from "@/hooks";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";
import type { PaginationState } from "@tanstack/react-table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";


/**
 * Admin page for managing job stage templates.
 * Displays searchable table with view, edit, and delete functionality.
 */
const AdminJobStages = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 500);
  // Reset to first page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);

  // Dialog states
  const [selectedTemplate, setSelectedTemplate] = useState<StageTemplate | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const {
    data,
    total,
    loading,
    fetchData: fetchTemplates,
  } = useAdminData<StageTemplate>(
    () => adminStageTemplateService.getAllTemplates(pageIndex * pageSize, pageSize, debouncedSearch),
    { fetchOnMount: false }
  );

  // Refetch when pagination or search changes
  useEffect(() => {
    fetchTemplates();
  }, [pageIndex, pageSize, debouncedSearch, fetchTemplates]);

  const [overallTotal, setOverallTotal] = useState(0);
  useEffect(() => {
    if (!debouncedSearch) {
      setOverallTotal(total);
    }
  }, [total, debouncedSearch]);

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

  const handleDeleteClick = (template: StageTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTemplate) return;

    try {
      await adminStageTemplateService.deleteTemplate(selectedTemplate.id);
      toast.success("Stage template deleted successfully");
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to delete stage template");
    } finally {
      setIsDeleteOpen(false);
      setSelectedTemplate(null);
    }
  };

  const columns: ColumnDef<StageTemplate>[] = [
    {
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
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "description",
      header: () => {
        return <div className="flex items-center gap-2">
          <span className="font-semibold">Description</span>
        </div>
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate line-clamp-1 max-w-md">
          {row.original.description || "No description"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => {
        return <div className="flex items-center justify-start gap-2">
          <span className="font-semibold">Actions</span>
        </div>
      },
      cell: ({ row }) => (
        <div className="flex items-center justify-start gap-2">
          <HoverCard  >
            <HoverCardTrigger>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleShow(row.original)}
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <Info className="h-4 w-4" />
                <span className="sr-only">Show</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
              View Details
            </HoverCardContent>
          </HoverCard>

          <HoverCard  >
            <HoverCardTrigger>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(row.original)}
                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
              Edit Template
            </HoverCardContent>
          </HoverCard>

          <HoverCard  >
            <HoverCardTrigger>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteClick(row.original)}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
              Delete Template
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
        actions={
          <Button
            onClick={() => navigate("/dashboard/admin/criteria-stages/stages/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Stage
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKey="name"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search templates..."
        isServerSide={true}
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={Math.ceil(total / pageSize)}
        onPaginationChange={setPagination}
        totalRecords={total}
        totalCount={overallTotal}
        resultCount={data.length}
        entityName="Templates"
      />


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

export default AdminJobStages;
