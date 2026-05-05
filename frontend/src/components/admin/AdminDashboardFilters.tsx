import { useState, useMemo } from "react";
import type { JobTitle } from "@/types/job";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Briefcase, ChevronDown, Layers, Building2, X } from "lucide-react";
import { FILTER_DISPLAY_LIMIT } from "@/constants";
import { Input } from "@/components/ui/input";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import type { FilterState } from "@/hooks";
import { Button } from "../ui/button";

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

  resetFilters,
  toggleFilter,
  clearFilter,
  hasActiveFilters,
}: AdminDashboardFiltersProps) => {

  const [jobSearch, setJobSearch] = useState("");
  const [stageSearch, setStageSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");

  const searchedJobs = useMemo(() => {
    if (!jobSearch.trim()) return filteredJobs.sort((a, b) => (b?.candidate_count || 0) - (a?.candidate_count || 0));
    const query = jobSearch.toLowerCase();
    return filteredJobs.filter((job) =>
      job.title.toLowerCase().includes(query)
    ).sort((a, b) => (b?.candidate_count || 0) - (a?.candidate_count || 0));
  }, [filteredJobs, jobSearch]);

  const searchedStages = useMemo(() => {
    if (!stageSearch.trim()) return stages;
    const query = stageSearch.toLowerCase();
    return stages.filter((stage) =>
      stage.name.toLowerCase().includes(query)
    );
  }, [stages, stageSearch]);

  const searchedDepartments = useMemo(() => {
    if (!departmentSearch.trim()) return departments;
    const query = departmentSearch.toLowerCase();
    return departments.filter((dept) =>
      dept.toLowerCase().includes(query)
    );
  }, [departments, departmentSearch]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 px-1 animate-in fade-in slide-in-from-left-2 duration-500">
      {/* Job Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
            selectedJobIds.length > 0
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Briefcase className="h-3.5 w-3.5 opacity-60" />
          <span className="truncate max-w-[150px]">
            {selectedJobIds.length === 0
              ? "Jobs"
              : selectedJobIds.length === 1
                ? jobs.find((j) => j.id === selectedJobIds[0])?.title || "1 Job"
                : `${selectedJobIds.length} Jobs`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-auto" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px] max-h-auto">
          <DropdownMenuGroup>
            <div className="px-1 pb-2">
              <div className="relative">
                <Input
                  placeholder="Search jobs..."
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  className="h-9 rounded-lg text-xs pl-2"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            {selectedJobIds.length > 0 && (
              <>
                <DropdownMenuCheckboxItem
                  checked={false}
                  onClick={() => clearFilter("jobIds")}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg"
                >
                  Clear Selection
                </DropdownMenuCheckboxItem>

              </>
            )}
            {searchedJobs.length === 0 ? (
              <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                No jobs found "{jobSearch}"
              </div>
            ) : (
              <>
                {searchedJobs.slice(0, FILTER_DISPLAY_LIMIT).map((job) => (
                  <DropdownMenuCheckboxItem
                    key={job.id}
                    checked={selectedJobIds.includes(job.id)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      toggleFilter("jobIds", job.id)
                    }
                    className="capitalize"
                  >
                    <HoverCard>
                      <HoverCardTrigger delay={10} closeDelay={10} className={"w-full"}>
                        <div className="flex items-center justify-between w-full">
                          <div className="capitalize truncate max-w-[140px] ">
                            {job.title}
                          </div>
                          <div className="text-xs bg-primary/10 px-1.5 py-0.5 rounded-full font-bold ml-2 shrink-0">
                            {job.candidate_count ?? 0}
                          </div>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64 p-2 rounded-lg" side="right" sideOffset={40}>
                        <div className="text-sm font-medium mb-0.5 capitalize flex items-center justify-between">
                          <span>{job.title}</span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                            {job.candidate_count ?? 0}
                          </span>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </DropdownMenuCheckboxItem>
                ))}
                {searchedJobs.length > FILTER_DISPLAY_LIMIT && (
                  <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                    And {searchedJobs.length - FILTER_DISPLAY_LIMIT} more jobs...
                  </div>
                )}
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Stage Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
            selectedStageNames.length > 0
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Layers className="h-3.5 w-3.5 opacity-60" />
          <span className="truncate max-w-[150px]">
            {selectedStageNames.length === 0
              ? "Stages"
              : selectedStageNames.length === 1
                ? selectedStageNames[0]
                : `${selectedStageNames.length} Stages`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-auto" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px] max-h-auto">
          <DropdownMenuGroup>
            <div className="px-1 pb-2">
              <div className="relative">
                <Input
                  placeholder="Search stages..."
                  value={stageSearch}
                  onChange={(e) => setStageSearch(e.target.value)}
                  className="h-9 rounded-lg text-xs pl-2"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            {selectedStageNames.length > 0 && (
              <>
                <DropdownMenuCheckboxItem
                  checked={false}
                  onClick={() => clearFilter("stages")}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg"
                >
                  Clear Selection
                </DropdownMenuCheckboxItem>

              </>
            )}
            {searchedStages.length === 0 ? (
              <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                No stages found "{stageSearch}"
              </div>
            ) : (
              <>
                {searchedStages.slice(0, FILTER_DISPLAY_LIMIT).map((stage) => (
                  <DropdownMenuCheckboxItem
                    key={stage.name}
                    checked={selectedStageNames.includes(stage.name)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      toggleFilter("stages", stage.name)
                    }
                    className={"capitalize"}
                  >
                    <HoverCard>
                      <HoverCardTrigger delay={10} closeDelay={10}>
                        <div className="truncate w-full max-w-40 ">
                          <span className="capitalize">
                            {stage.name}
                          </span>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64 p-2 rounded-lg" side="right" sideOffset={40}>
                        <div className="text-sm font-medium mb-0.5 capitalize">{stage.name}</div>
                      </HoverCardContent>
                    </HoverCard>
                  </DropdownMenuCheckboxItem>
                ))}
                {searchedStages.length > FILTER_DISPLAY_LIMIT && (
                  <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                    And {searchedStages.length - FILTER_DISPLAY_LIMIT} more stages...
                  </div>
                )}
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Department Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
            selectedDepartments.length > 0
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Building2 className="h-3.5 w-3.5 opacity-60" />
          <span className="truncate max-w-[150px] capitalize">
            {selectedDepartments.length === 0
              ? "Departments"
              : selectedDepartments.length === 1
                ? selectedDepartments[0]
                : `${selectedDepartments.length} Departments`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-auto" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px] max-h-auto">
          <DropdownMenuGroup>
            <div className="px-1 pb-2">
              <div className="relative">
                <Input
                  placeholder="Search departments..."
                  value={departmentSearch}
                  onChange={(e) => setDepartmentSearch(e.target.value)}
                  className="h-9 rounded-lg text-xs pl-2"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            {selectedDepartments.length > 0 && (
              <>
                <DropdownMenuCheckboxItem
                  checked={false}
                  onClick={() => clearFilter("departments")}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg"
                >
                  Clear Selection
                </DropdownMenuCheckboxItem>

              </>
            )}
            {searchedDepartments.length === 0 ? (
              <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                No departments found "{departmentSearch}"
              </div>
            ) : (
              <>
                {searchedDepartments.slice(0, FILTER_DISPLAY_LIMIT).map((dept) => (
                  <DropdownMenuCheckboxItem
                    key={dept}
                    checked={selectedDepartments.includes(dept)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      toggleFilter("departments", dept)
                    }
                    className={"capitalize"}
                  >
                    <HoverCard>
                      <HoverCardTrigger delay={10} closeDelay={10}>
                        <div className="truncate w-full max-w-40 ">
                          <span className="capitalize">
                            {dept}
                          </span>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64 p-2 rounded-lg" side="right" sideOffset={40}>
                        <div className="text-sm font-medium mb-0.5 capitalize">{dept}</div>
                      </HoverCardContent>
                    </HoverCard>
                  </DropdownMenuCheckboxItem>
                ))}
                {searchedDepartments.length > FILTER_DISPLAY_LIMIT && (
                  <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                    And {searchedDepartments.length - FILTER_DISPLAY_LIMIT} more departments...
                  </div>
                )}
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {hasActiveFilters && (
        <HoverCard>
          <HoverCardTrigger delay={10} closeDelay={100}
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                onClick={resetFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            }
          />
          <HoverCardContent className="flex items-center justify-center w-auto h-auto p-3 rounded-2xl border bg-popover shadow-2xl overflow-hidden">
            <div className="font-medium text-sm">Clear all filters</div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
};

export default AdminDashboardFilters;
