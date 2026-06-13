import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Calendar as CalendarIcon, ChevronDown, X, } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator";
import { FILTER_DISPLAY_LIMIT } from "@/constants";
import { useMemo } from "react";
import { SearchableSelect } from "@/components/shared";
// import { DateDisplay } from "../shared";

interface CandidateTableFiltersProps {
  nameFilter: string;
  setNameFilter: (value: string) => void;
  statusFilter: string[];
  setStatusFilter: (value: string[]) => void;
  locationFilter: string[];
  setLocationFilter: (value: string[]) => void;
  jobFilter: string[];
  setJobFilter: (value: string[]) => void;
  showJobContext?: boolean;
  showLocationFilter?: boolean;
  showStatusFilter?: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  hrDecisionFilter: string[];
  setHrDecisionFilter: (value: string[]) => void;
  resultFilter: string[];
  setResultFilter: (value: string[]) => void;
  statusOptions: string[];
  locationOptions: string[];
  locationSearch: string;
  setLocationSearch: (value: string) => void;
  jobOptions: { id: string; title: string; slug: string }[];
  jobSearch: string;
  setJobSearch: (value: string) => void;
  stageFilter: string[];
  setStageFilter: (value: string[]) => void;
  stageOptions: { id: string; name: string }[];
  hrDecisionOptions: { value: string; label: string }[];
  resultOptions: { value: string; label: string }[];
  hasActiveFilters: boolean;
  clearFilters: () => void;
  resultCount: number;
  totalCount: number;
  minDate: Date;
  availableJobs: {
    id: string;
    title: string;
    slug: string;
  }[];
  activitySession: string[];
  setActivitySession: (value: string[]) => void;
  activitySearch: string;
  setActivitySearch: (value: string) => void;
  activitySessionOptions?: [number, { start_date: string; end_date: string }][];
  hrScoreFilter?: number[];
  setHrScoreFilter?: (value: number[]) => void;
  testEmailSentFilter?: string;
  setTestEmailSentFilter?: (value: string | undefined) => void;
  isTestPaperFilterEnabled?: boolean;
}

export const CandidateTableFilters = ({
  nameFilter,
  setNameFilter,
  locationFilter,
  setLocationFilter,
  jobFilter,
  setJobFilter,
  showJobContext = false,
  dateRange,
  setDateRange,
  hrDecisionFilter,
  setHrDecisionFilter,
  resultFilter,
  setResultFilter,
  locationOptions,
  setLocationSearch,
  jobOptions,
  setJobSearch,
  stageFilter,
  setStageFilter,
  stageOptions,
  hrDecisionOptions,
  resultOptions,
  hasActiveFilters,
  clearFilters,
  resultCount,
  totalCount,
  minDate,
  showLocationFilter = true,
  // activitySession,
  // setActivitySession,
  activitySearch,
  // setActivitySearch,
  activitySessionOptions,
  hrScoreFilter = [],
  setHrScoreFilter = () => { },
  testEmailSentFilter,
  setTestEmailSentFilter = () => { },
  isTestPaperFilterEnabled = false,
}: CandidateTableFiltersProps) => {

  // @ts-ignore
  const _filteredActivityOptions = useMemo(() => {
    if (!activitySessionOptions) return [];
    if (!activitySearch.trim()) return activitySessionOptions;
    const query = activitySearch.toLowerCase();
    return activitySessionOptions.filter(([sessionId, dates]) => {
      const idStr = String(sessionId).toLowerCase();
      const startStr = dates.start_date ? format(new Date(dates.start_date), "MMM d").toLowerCase() : "";
      const endStr = dates.end_date ? format(new Date(dates.end_date), "MMM d").toLowerCase() : "present";
      return idStr.includes(query) || startStr.includes(query) || endStr.includes(query);
    });
  }, [activitySessionOptions, activitySearch]);

  const formattedJobOptions = useMemo(() => {
    return jobOptions.map((j) => ({
      id: j.id,
      label: j.title,
      hoverContent: (
        <div className="text-sm font-medium mb-0.5 capitalize">{j.title}</div>
      ),
    }));
  }, [jobOptions]);

  const formattedLocationOptions = useMemo(() => {
    return locationOptions.map((l) => ({ id: l, label: l }));
  }, [locationOptions]);

  const formattedHrDecisionOptions = useMemo(() => {
    return hrDecisionOptions.map((d) => ({ id: d.value, label: d.label }));
  }, [hrDecisionOptions]);

  const formattedResultOptions = useMemo(() => {
    return resultOptions.map((d) => ({ id: d.value, label: d.label }));
  }, [resultOptions]);

  const formattedStageOptions = useMemo(() => {
    return stageOptions.map((s) => ({ id: s.id, label: s.name }));
  }, [stageOptions]);

  const normalStyle = "inline-flex items-center justify-between gap-2 h-10 px-3 rounded-xl border text-sm cursor-pointer select-none transition-all"
  return (
    <div className="flex flex-col gap-4 p-2 bg-muted/20 rounded-2xl border border-muted-foreground/10 overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start gap-4 w-full">
        {/* All Filters Area */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Field */}
          <div className="relative w-full lg:w-[320px] group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Search name or email…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="pl-10 h-10 rounded-xl text-sm w-full bg-background"
            />
          </div>

          {/* Job dropdown */}
          {showJobContext && (
            <SearchableSelect
              multiple
              value={jobFilter}
              onValueChange={setJobFilter}
              options={formattedJobOptions}
              placeholder="All Jobs"
              onSearch={setJobSearch}
              onClear={() => setJobFilter([])}
              clearLabel="Clear jobs"
              getTriggerLabel={(selected) =>
                selected.length === 0
                  ? "All Jobs"
                  : selected.length <= FILTER_DISPLAY_LIMIT
                    ? selected.map((s) => s.label).join(", ")
                    : `${selected.slice(0, FILTER_DISPLAY_LIMIT).map((s) => s.label).join(", ")} and ${selected.length - FILTER_DISPLAY_LIMIT} more`
              }
              triggerClassName={cn(
                normalStyle,
                "w-[140px]",
                jobFilter.length > 0
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              contentClassName="w-[240px]"
            />
          )}

          {/* Location dropdown */}
          {showLocationFilter && (
            <SearchableSelect
              multiple
              value={locationFilter}
              onValueChange={setLocationFilter}
              options={formattedLocationOptions}
              placeholder="Locations"
              onSearch={setLocationSearch}
              onClear={() => setLocationFilter([])}
              clearLabel="Clear locations"
              getTriggerLabel={(selected) =>
                selected.length === 0
                  ? "Locations"
                  : selected.length <= FILTER_DISPLAY_LIMIT
                    ? selected.map((s) => s.label).join(", ")
                    : `${selected.slice(0, FILTER_DISPLAY_LIMIT).map((s) => s.label).join(", ")} and ${selected.length - FILTER_DISPLAY_LIMIT} more`
              }
              triggerClassName={cn(
                normalStyle,
                "w-[130px]",
                locationFilter.length > 0
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              contentClassName="w-[160px]"
            />
          )}

          {/* HR Decision multi-select dropdown */}
          <SearchableSelect
            multiple
            value={hrDecisionFilter}
            onValueChange={setHrDecisionFilter}
            options={formattedHrDecisionOptions}
            placeholder="Decisions"
            pluralLabel="Decisions"
            onClear={() => setHrDecisionFilter([])}
            clearLabel="Clear selection"
            triggerClassName={cn(
              normalStyle,
              "w-[130px]",
              hrDecisionFilter.length > 0
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/5 hover:text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            contentClassName="w-fit min-w-[130px]"
          />

          {/* resume screening result dropdown */}
          <SearchableSelect
            multiple
            value={resultFilter}
            onValueChange={setResultFilter}
            options={formattedResultOptions}
            placeholder="AI Result"
            pluralLabel="Results"
            onClear={() => setResultFilter([])}
            clearLabel="Clear selection"
            getTriggerLabel={(selected) =>
              selected.length === 0
                ? "AI Result"
                : selected.length === 1
                  ? selected[0].label
                  : `${selected.length} Results`
            }
            triggerClassName={cn(
              normalStyle,
              "w-[130px]",
              resultFilter.length > 0
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/5 hover:text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            contentClassName="w-fit min-w-[130px]"
          />

          {/* Score Rating multi-select dropdown */}
          <SearchableSelect
            multiple
            value={hrScoreFilter.map(String)}
            onValueChange={(val) => setHrScoreFilter(val.map(Number))}
            options={[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((score) => ({ id: String(score), label: score.toFixed(1) }))}
            placeholder="Score Rating"
            pluralLabel="Ratings"
            onClear={() => setHrScoreFilter([])}
            clearLabel="Clear selection"
            getTriggerLabel={(selected) =>
              selected.length === 0
                ? "Score Rating"
                : selected.length === 1
                  ? `Score: ${selected[0].label}`
                  : `${selected.length} Ratings`
            }
            triggerClassName={cn(
              normalStyle,
              "w-[130px]",
              hrScoreFilter.length > 0
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/5 hover:text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            contentClassName="w-fit min-w-[130px]"
          />

          {/* Stages multi-select dropdown */}
          <SearchableSelect
            multiple
            value={stageFilter}
            onValueChange={setStageFilter}
            options={formattedStageOptions}
            placeholder="Stages"
            pluralLabel="Stages"
            onClear={() => setStageFilter([])}
            clearLabel="Clear selection"
            triggerClassName={cn(
              normalStyle,
              "w-[130px]",
              stageFilter.length > 0
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/5 hover:text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            contentClassName="w-fit min-w-[130px]"
          />

          {/* Test Paper dropdown */}
          <SearchableSelect
            value={testEmailSentFilter ?? ""}
            onValueChange={(val) => setTestEmailSentFilter(val || undefined)}
            options={[
              { id: "sent", label: "Sent" },
              { id: "not_sent", label: "Not Sent" }
            ]}
            placeholder="Test Email Sent"
            onClear={() => setTestEmailSentFilter(undefined)}
            clearLabel="Clear selection"
            disabled={!isTestPaperFilterEnabled}
            triggerClassName={cn(
              normalStyle,
              "w-[140px]",
              testEmailSentFilter
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/5 hover:text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              !isTestPaperFilterEnabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
            contentClassName="w-fit min-w-[140px]"
          />

          {/* Date range picker */}
          <div className="flex items-center gap-1.5 px-3 h-10 w-fit rounded-xl border border-input text-sm bg-background hover:bg-muted/30 transition-colors">
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
                      "Applied date range"
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
                  required
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

          {/* Clear Button */}
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
                <div className="font-medium text-sm">Clear all filters</div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>

        {/* Result Count Area (Anchored Right) */}
        <div className="shrink-0 lg:ml-auto text-xs font-medium flex items-center gap-2 p-2 border rounded-xl bg-background/50 h-10 self-start">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold">{totalCount}</span>
          <span className="text-muted-foreground">Candidates</span>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <span className="font-bold">{resultCount}</span>
          <span className="text-muted-foreground">Candidates found</span>
        </div>
      </div>
    </div>
  );
};
