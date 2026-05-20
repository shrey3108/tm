import { useState, useEffect } from "react";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Info, Edit2, Trash2, ArrowUpDown, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch"
import { extractErrorMessage } from "@/utils/error";

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
    setData,
    setTotal,
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

  const handleDefaultToggle = async (template: StageTemplate, isChecked: boolean) => {
    const previousData = [...data];

    // Optimistic update
    setData(prev => prev.map(t =>
      t.id === template.id ? { ...t, is_default: isChecked } : t
    ));

    try {
      await adminStageTemplateService.updateTemplate(template.id, { is_default: isChecked });
      toast.success("Stage template updated successfully");

      // fetchTemplates(); 
    } catch (error) {
      // Revert on error
      const errorMessage = extractErrorMessage(error)
      setData(previousData);
      toast.error(errorMessage || "Failed to update stage template");
    }
  };

  const handleDeleteClick = (template: StageTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTemplate) return;

    const previousData = [...data];
    const previousTotal = total;

    // Optimistic update
    setData(prev => prev.filter(t => t.id !== selectedTemplate.id));
    setTotal(prev => prev - 1);

    try {
      await adminStageTemplateService.deleteTemplate(selectedTemplate.id);
      toast.success("Stage template deleted successfully");
      // fetchTemplates(); 
    } catch (error) {
      // Revert on error
      const errorMessage = extractErrorMessage(error)
      setData(previousData);
      setTotal(previousTotal);
      toast.error(errorMessage || "Failed to delete stage template");
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
        <span className="font-medium text-foreground capitalize">{row.original.name}</span>
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
        <span className="text-muted-foreground truncate line-clamp-1 max-w-sm capitalize">
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
          className="hover:bg-transparent p-0 font-semibold"
        >
          Default Stage
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <Switch
            checked={row.original.is_default ?? false}
            onCheckedChange={(isChecked) => handleDefaultToggle(row.original, isChecked)}
            size="sm"
          />
        </div>
      ),
    },
    {
      id: "actions",
      header: () => {
        return <div className="flex items-center justify-center gap-2">
          <span className="font-semibold">Actions</span>
        </div>
      },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <HoverCard>
            <HoverCardTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon"
                  onClick={() => handleShow(row.original)}
                  className="h-9 w-9 rounded-xl text-blue-500 hover:bg-blue-500/10 hover:text-blue-600 transition-colors flex items-center justify-center shrink-0"
                >
                  <Info className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Show</span>
                </Button>
              )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
              <span className="text-blue-600">View Info</span>
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
                  className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                >
                  <Edit2 className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Edit</span>
                </Button>
              )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
              <span className="text-primary">Edit Stage</span>
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
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Delete</span>
                </Button>
              )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
              <span className="text-destructive">Delete Stage</span>
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
