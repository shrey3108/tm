import { type RefObject } from "react";
import { Upload, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components";
import { SearchableSelect } from "@/components/shared";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuestionsBankFiltersProps {
  selectedDeptId: string;
  setSelectedDeptId: (id: string) => void;
  departments: Array<{ id: string; name: string }> | null;
  loadingDepts: boolean;
  isDeptSearching: boolean;
  handleDeptSearch: (query: string) => void;

  selectedPositionId: string;
  setSelectedPositionId: (id: string) => void;
  positions: Array<{ id: string; name: string }> | null;
  loadingPositions: boolean;

  selectedContentType: string;
  setSelectedContentType: (type: string) => void;

  isUploading: boolean;
  handleUploadClick: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAddDropdownSelect: (type: "question" | "project_task" | "mcq") => void;
}

export function QuestionsBankFilters({
  selectedDeptId,
  setSelectedDeptId,
  departments,
  loadingDepts,
  isDeptSearching,
  handleDeptSearch,
  selectedPositionId,
  setSelectedPositionId,
  positions,
  loadingPositions,
  selectedContentType,
  setSelectedContentType,
  isUploading,
  handleUploadClick,
  fileInputRef,
  handleFileChange,
  handleAddDropdownSelect,
}: QuestionsBankFiltersProps) {
  const contentTypeOptions = [
    { id: "all", label: "All Types" },
    { id: "question", label: "Questions" },
    { id: "project_task", label: "Project Tasks" },
    { id: "mcq", label: "MCQs" },
  ];

  return (
    <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 rounded-xl border border-border bg-card p-2 shadow-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 flex-1">
        {/* Department Selector */}
        <div className="flex flex-col gap-0.5 w-full">
          <Label className="text-xs font-semibold">Select Department</Label>
          <SearchableSelect
            value={selectedDeptId}
            onValueChange={setSelectedDeptId}
            options={departments?.map((dept) => ({ id: dept.id, label: dept.name })) || []}
            placeholder="Choose a department..."
            searchPlaceholder="Search departments..."
            disabled={!departments || departments.length === 0}
            loading={loadingDepts}
            loadingPlaceholder="Loading departments..."
            emptyMessage="No departments found"
            moreText="departments"
            onSearch={handleDeptSearch}
            asyncLoading={isDeptSearching}
          />
        </div>

        {/* Experience / Position Level Selector */}
        <div className="flex flex-col gap-0.5 w-full">
          <Label className="text-xs font-semibold">Experience / Position Level</Label>
          <SearchableSelect
            value={selectedPositionId}
            onValueChange={setSelectedPositionId}
            options={positions?.map((pos) => ({ id: pos.id, label: pos.name })) || []}
            placeholder="All position levels"
            searchPlaceholder="Search position levels..."
            disabled={loadingPositions}
            loading={loadingPositions}
            loadingPlaceholder="Loading positions..."
            emptyMessage="No position levels found"
            moreText="position levels"
            onClear={() => setSelectedPositionId("")}
            clearLabel="Clear position filter"
          />
        </div>

        {/* Content Type Selector */}
        <div className="flex flex-col gap-0.5 w-full">
          <Label className="text-xs font-semibold">Content Type</Label>
          <SearchableSelect
            value={selectedContentType}
            onValueChange={setSelectedContentType}
            options={contentTypeOptions}
            placeholder="All Types"
            searchPlaceholder="Search content types..."
            emptyMessage="No content types found"
            onClear={() => setSelectedContentType("all")}
            clearLabel="Clear content type filter"
          />
        </div>
      </div>

      {/* Action Upload Widget */}
      <div className="flex items-end justify-end shrink-0 gap-2 xl:self-end">
        <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx"
            className="hidden"
          />
          <Button
            onClick={handleUploadClick}
            disabled={!selectedDeptId || isUploading}
            variant="outline"
            className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-11"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload new set"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                disabled={!selectedDeptId}
                className="rounded-xl px-5 font-semibold text-center h-11 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl p-1.5 min-w-[160px]">
              <DropdownMenuItem
                onClick={() => handleAddDropdownSelect("question")}
                className="rounded-lg font-medium cursor-pointer"
              >
                Normal Question
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAddDropdownSelect("mcq")}
                className="rounded-lg font-medium cursor-pointer"
              >
                MCQ (Multiple Choice)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAddDropdownSelect("project_task")}
                className="rounded-lg font-medium cursor-pointer"
              >
                Project Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PermissionGuard>
      </div>
    </div>
  );
}
