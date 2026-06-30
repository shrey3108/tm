import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { DepartmentRead } from "@/types/department";
import { HoverCard, HoverCardContent, HoverCardTrigger, } from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator";
import { FILTER_DISPLAY_LIMIT } from "@/constants";
import { SearchableSelect } from "@/components/shared/SearchableSelect";

interface JobTableFiltersProps {
  titleFilter: string;
  setTitleFilter: (value: string) => void;
  statusFilter: string[];
  setStatusFilter: (value: string[]) => void;
  statusOptions: string[];
  departmentFilter: string[];
  setDepartmentFilter: (value: string[]) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  departmentOptions: DepartmentRead[];
  departmentSearch: string;
  setDepartmentSearch: (value: string) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  resultCount: number;
  totalCount: number;
  minDate: Date
}

export const JobTableFilters = ({
  titleFilter,
  setTitleFilter,
  statusFilter,
  setStatusFilter,
  statusOptions,
  departmentFilter,
  setDepartmentFilter,
  dateRange,
  setDateRange,
  departmentOptions,
  setDepartmentSearch,
  hasActiveFilters,
  clearFilters,
  resultCount,
  totalCount,
  minDate,
}: JobTableFiltersProps) => {

  return (
    <div className="flex flex-col gap-4 p-4 bg-muted/20 rounded-2xl border border-muted-foreground/10 overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start gap-4 w-full">
        {/* All Filters Area */}
        <div className="flex flex-wrap items-center gap-2 flex-1 ">
          {/* Title Search */}
          <div className="relative w-full lg:w-[320px] group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Search job title..."
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              className="pl-10 h-10 rounded-xl text-sm w-full bg-background"
            />
          </div>

          {/* Status Dropdown */}
          <SearchableSelect
            multiple
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={statusOptions.map((s) => ({ id: s, label: s }))}
            placeholder="Statuses"
            pluralLabel="Statuses"
            onClear={() => setStatusFilter([])}
            clearLabel="Clear statuses"
            triggerClassName={cn(
              "h-10 w-[130px] border font-medium select-none bg-background hover:bg-muted/50 hover:text-foreground",
              statusFilter.length > 0
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                : "border-input text-muted-foreground"
            )}
          // contentClassName="w-[50%]"
          />

          {/* Department Dropdown */}
          {departmentOptions.length > 0 && (
            <SearchableSelect
              multiple
              value={departmentFilter}

              onValueChange={setDepartmentFilter}
              options={departmentOptions.map((d) => ({ id: d.id, label: d.name }))}
              placeholder="Departments"
              pluralLabel="Departments"
              onSearch={setDepartmentSearch}
              onClear={() => setDepartmentFilter([])}
              clearLabel="Clear departments"
              getTriggerLabel={(selected) =>
                selected.length <= FILTER_DISPLAY_LIMIT
                  ? selected.map((s) => s.label).join(", ")
                  : `${selected.slice(0, FILTER_DISPLAY_LIMIT).map((s) => s.label).join(", ")} and ${selected.length - FILTER_DISPLAY_LIMIT} more`
              }
              triggerClassName={cn(
                "h-10 w-[160px] border font-medium select-none bg-background hover:bg-muted/50 hover:text-foreground",
                departmentFilter.length > 0
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                  : "border-input text-muted-foreground"
              )}
            // contentClassName="min-w-[160px]"
            />
          )}

          {/* Date Range Picker */}
          <div className="flex items-center gap-1.5 px-3 h-10 w-fit rounded-xl border border-input text-xs bg-background hover:bg-muted/30 transition-colors">
            <Popover>
              <PopoverTrigger
                className={cn(
                  "inline-flex items-center justify-between w-full h-full font-normal rounded-md bg-transparent focus-visible:outline-none",
                  !dateRange?.from && "text-muted-foreground"
                )}
              >
                <div className="flex items-center truncate">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      "Created date range"
                    )}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0 ml-1" />
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 rounded-2xl border bg-popover shadow-2xl overflow-hidden"
                align="start"
              >
                <Calendar
                  autoFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  disabled={{ after: new Date(), before: minDate }}
                  buttonVariant="ghost"
                  captionLayout="label"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Clear Logic */}
          {hasActiveFilters && (
            <HoverCard>
              <HoverCardTrigger delay={10} closeDelay={100}
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-gray-200/60"
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
        </div>

        {/* Result Count Area (Anchored Right) */}
        <div className="shrink-0 lg:ml-auto text-xs font-medium flex items-center gap-2 p-2 border rounded-xl bg-background/50 h-10 self-start">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold">{totalCount}</span>
          <span className="text-muted-foreground">Jobs</span>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <span className="font-bold">{resultCount}</span>
          <span className="text-muted-foreground">Jobs found</span>
        </div>
      </div>
    </div>
  );
};
