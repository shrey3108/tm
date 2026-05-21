import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, capitalize } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { DepartmentRead } from "@/types/admin";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

import { Separator } from "@/components/ui/separator";
import { FILTER_DISPLAY_LIMIT } from "@/constants";

interface JobTableFiltersProps {
  titleFilter: string;
  setTitleFilter: (value: string) => void;
  statusFilter: string[];
  setStatusFilter: (value: string[]) => void;
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
  departmentFilter,
  setDepartmentFilter,
  dateRange,
  setDateRange,
  departmentOptions,
  departmentSearch,
  setDepartmentSearch,
  hasActiveFilters,
  clearFilters,
  resultCount,
  totalCount,
  minDate,
}: JobTableFiltersProps) => {
  const statusOptions = ["open", "closed"];

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
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center justify-between gap-2 h-10 px-3 w-[130px] rounded-xl border text-sm font-medium cursor-pointer select-none transition-all",
                statusFilter.length > 0
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className="truncate">
                {statusFilter.length === 0
                  ? "Statuses"
                  : statusFilter.length === 1
                    ? capitalize(statusFilter[0])
                    : `${statusFilter.length} Statuses`}
              </span>
              <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-fit min-w-[130px] p-2 rounded-xl shadow-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {statusOptions.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter.includes(s)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      setStatusFilter(
                        statusFilter.includes(s)
                          ? statusFilter.filter((v) => v !== s)
                          : [...statusFilter, s]
                      )
                    }
                    className="rounded-lg my-0.5 capitalize pl-2 pr-6"
                  >
                    {capitalize(s)}
                  </DropdownMenuCheckboxItem>
                ))}
                {statusFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setStatusFilter([])}
                      className="rounded-lg"
                    >
                      Clear statuses
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Department Dropdown */}
          {departmentOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center justify-between gap-2 h-10 px-3 w-[160px] rounded-xl border text-sm font-medium cursor-pointer select-none transition-all",
                  departmentFilter.length > 0
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="truncate mr-auto text-left">
                  {departmentFilter.length === 0
                    ? "Departments"
                    : departmentFilter.length <= FILTER_DISPLAY_LIMIT
                      ? departmentFilter.map(id => departmentOptions.find(d => d.id === id)?.name || id).join(", ")
                      : `${departmentFilter.slice(0, FILTER_DISPLAY_LIMIT).map(id => departmentOptions.find(d => d.id === id)?.name || id).join(", ")} and ${departmentFilter.length - FILTER_DISPLAY_LIMIT} more`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-fit min-w-[160px] p-2 rounded-xl shadow-xl">
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
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  <DropdownMenuGroup>
                    {departmentOptions.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                        No departments found "{departmentSearch}"
                      </div>
                    ) : (
                      <>
                        {departmentOptions.slice(0, FILTER_DISPLAY_LIMIT).map((d) => (
                          <DropdownMenuCheckboxItem
                            key={d.id}
                            checked={departmentFilter.includes(d.id)}
                            onSelect={(e) => e.preventDefault()}
                            onClick={() =>
                              setDepartmentFilter(
                                departmentFilter.includes(d.id)
                                  ? departmentFilter.filter((v) => v !== d.id)
                                  : [...departmentFilter, d.id]
                              )
                            }
                            className="rounded-lg my-0.5 capitalize pl-2 pr-6"
                          >
                            {d.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {departmentOptions.length > FILTER_DISPLAY_LIMIT && (
                          <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                            And {departmentOptions.length - FILTER_DISPLAY_LIMIT} more departments...
                          </div>
                        )}
                      </>
                    )}
                  </DropdownMenuGroup>
                </div>
                {departmentFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDepartmentFilter([])}
                      className="rounded-lg"
                    >
                      Clear departments
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
                    className="h-10 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                    onClick={clearFilters}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                }
              />
              <HoverCardContent className="flex items-center justify-center w-auto h-auto p-3 rounded-2xl border bg-popover shadow-2xl overflow-hidden">
                <div className="font-semibold">Clear all filters</div>
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
