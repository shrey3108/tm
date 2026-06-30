import { useMemo } from "react";
import type { JobTitle } from "@/types/job";
import { cn } from "@/lib/utils";
import { Briefcase, Layers, Building2, X } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import type { FilterState } from "@/hooks/useAdminDashboardFilters";

interface AdminDashboardFiltersProps {
  selectedDepartments: string[];
  departments: string[];
  selectedJobIds: string[];
  jobs: (JobTitle & { candidate_count?: number })[];
  filteredJobs: (JobTitle & { candidate_count?: number })[];
  selectedStageNames: string[];
  stages: { name: string }[];
  setFilter: <K extends keyof FilterState>(key: K, values: FilterState[K]) => void;
  resetFilters: () => void;
  toggleFilter: <K extends keyof FilterState>(key: K, value: FilterState[K][number]) => void;
  clearFilter: <K extends keyof FilterState>(key: K) => void;
  hasActiveFilters: boolean;
}
/**
 * Filter component for admin dashboard
 * @param selectedDepartment - Currently selected department
 * @param setSelectedDepartment - Function to set selected department
 * @param departments - List of all departments
 * @param selectedJobId - Currently selected job
 * @param setSelectedJobId - Function to set selected job
 * @param jobs - List of all jobs
 * @param filteredJobs - List of filtered jobs
 * @param selectedStageName - Currently selected stage
 * @param setSelectedStageName - Function to set selected stage
 * @param stages - List of all stages
 */
const AdminDashboardFilters = ({
  selectedDepartments,
  departments,
  selectedJobIds,
  jobs,
  filteredJobs,
  selectedStageNames,
  stages,
  setFilter,
  resetFilters,
  clearFilter,
  hasActiveFilters,
}: AdminDashboardFiltersProps) => {

  const formattedJobOptions = useMemo(() => {
    const sortedJobs = [...filteredJobs].sort((a, b) => (b?.candidate_count || 0) - (a?.candidate_count || 0));
    return sortedJobs.map((job) => ({
      id: job.id,
      label: job.title,
      badgeCount: job.candidate_count ?? 0,
      hoverContent: (
        <div className="text-sm font-medium mb-0.5 capitalize flex items-center justify-between w-full">
          <span>{job.title}</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold ml-2 shrink-0">
            {job.candidate_count ?? 0}
          </span>
        </div>
      ),
    }));
  }, [filteredJobs]);

  const formattedStageOptions = useMemo(() => {
    return stages.map((stage) => ({
      id: stage.name,
      label: stage.name,
      // hoverContent: (
      //   <div className="text-sm font-medium mb-0.5 capitalize">{stage.name}</div>
      // ),
    }));
  }, [stages]);

  const formattedDepartmentOptions = useMemo(() => {
    return departments.map((dept) => ({
      id: dept,
      label: dept,
      // hoverContent: (
      //   <div className="text-sm font-medium mb-0.5 capitalize">{dept}</div>
      // ),
    }));
  }, [departments]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 px-1 animate-in fade-in slide-in-from-left-2 duration-500">
      {/* Job Filter */}
      <SearchableSelect
        multiple
        value={selectedJobIds}
        onValueChange={(val) => setFilter("jobIds", val)}
        options={formattedJobOptions}
        placeholder="Jobs"
        pluralLabel="Jobs"
        onClear={() => clearFilter("jobIds")}
        clearLabel="Clear Selection"
        icon={<Briefcase className="h-3.5 w-3.5 opacity-60" />}
        getTriggerLabel={(selected) =>
          selected.length === 0
            ? "Jobs"
            : selected.length === 1
              ? (jobs.find((j) => j.id === selected[0].id)?.title || "1 Job")
              : `${selected.length} Jobs`
        }
        triggerClassName={cn(
          "w-fit inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
          selectedJobIds.length > 0
            ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/5 hover:text-foreground"
            : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        contentClassName="min-w-50"
      />

      {/* Stage Filter */}
      <SearchableSelect
        multiple
        value={selectedStageNames}
        onValueChange={(val) => setFilter("stages", val)}
        options={formattedStageOptions}
        placeholder="Stages"
        pluralLabel="Stages"
        onClear={() => clearFilter("stages")}
        clearLabel="Clear Selection"
        icon={<Layers className="h-3.5 w-3.5 opacity-60" />}
        getTriggerLabel={(selected) =>
          selected.length === 0
            ? "Stages"
            : selected.length === 1
              ? selected[0].label
              : `${selected.length} Stages`
        }
        triggerClassName={cn(
          "w-fit inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
          selectedStageNames.length > 0
            ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/5 hover:text-foreground"
            : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        contentClassName="min-w-50"
      />

      {/* Department Filter */}
      <SearchableSelect
        multiple
        value={selectedDepartments}
        onValueChange={(val) => setFilter("departments", val)}
        options={formattedDepartmentOptions}
        placeholder="Departments"
        pluralLabel="Departments"
        onClear={() => clearFilter("departments")}
        clearLabel="Clear Selection"
        icon={<Building2 className="h-3.5 w-3.5 opacity-60" />}
        getTriggerLabel={(selected) =>
          selected.length === 0
            ? "Departments"
            : selected.length === 1
              ? selected[0].label
              : `${selected.length} Departments`
        }
        triggerClassName={cn(
          "w-fit inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
          selectedDepartments.length > 0
            ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/5 hover:text-foreground"
            : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        contentClassName="min-w-50"
      />
      {hasActiveFilters && (
        <HoverCard>
          <HoverCardTrigger delay={10} closeDelay={100}
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-gray-200/60"
                onClick={resetFilters}
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
    </div>
  );
};

export default AdminDashboardFilters;
