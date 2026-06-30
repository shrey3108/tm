import { Plus, X } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";

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

  selectedSkillId: string;
  setSelectedSkillId: (id: string) => void;
  skills: Array<{ id: string; name: string }> | null;
  loadingSkills: boolean;
  isSkillSearching: boolean;
  handleSkillSearch: (query: string) => void;

  selectedContentType: string;
  setSelectedContentType: (type: string) => void;

  hasActiveFilters: boolean;
  clearFilters: () => void;

  onCreateNew: () => void;
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
  selectedSkillId,
  setSelectedSkillId,
  skills,
  loadingSkills,
  isSkillSearching,
  handleSkillSearch,
  selectedContentType,
  setSelectedContentType,
  hasActiveFilters,
  clearFilters,
  onCreateNew,
}: QuestionsBankFiltersProps) {
  const contentTypeOptions = [
    { id: "all", label: "All Types" },
    { id: "question", label: "Default" },
    { id: "project_task", label: "Project Tasks" },
    { id: "mcq", label: "MCQs" },
  ];

  return (
    <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 rounded-xl border border-border bg-card p-2 shadow-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 flex-1">
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
            onClear={() => setSelectedDeptId("")}
            clearLabel="Clear department filter"
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

        {/* Skill Selector */}
        <div className="flex flex-col gap-0.5 w-full">
          <Label className="text-xs font-semibold">Select Skill</Label>
          <SearchableSelect
            value={selectedSkillId}
            onValueChange={setSelectedSkillId}
            options={skills?.map((skill) => ({ id: skill.id, label: skill.name })) || []}
            placeholder="All skills"
            searchPlaceholder="Search skills..."
            disabled={loadingSkills || !selectedDeptId || !selectedPositionId}
            loading={loadingSkills}
            loadingPlaceholder="Loading skills..."
            emptyMessage="No skills found"
            moreText="skills"
            onSearch={handleSkillSearch}
            asyncLoading={isSkillSearching}
            onClear={() => setSelectedSkillId("")}
            clearLabel="Clear skill filter"
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
        {hasActiveFilters && (
          <HoverCard>
            <HoverCardTrigger delay={10} closeDelay={100}
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-gray-200/60"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4" />
                </Button>
              }
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
              Clear all filters
            </HoverCardContent>
          </HoverCard>
        )}
        <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
          <Button
            onClick={onCreateNew}
            disabled={!selectedDeptId || !selectedPositionId}
            className="rounded-xl px-5 font-semibold text-center h-11 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create New
          </Button>
        </PermissionGuard>
      </div>
    </div>
  );
}
