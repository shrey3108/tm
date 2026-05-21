import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Calendar as CalendarIcon, ChevronDown, X, } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
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
import { useMemo } from "react";
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
  stageOptions: string[];
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
  locationSearch,
  setLocationSearch,
  jobOptions,
  jobSearch,
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
  availableJobs,
  showLocationFilter = true,
  // activitySession,
  // setActivitySession,
  activitySearch,
  // setActivitySearch,
  activitySessionOptions,
  hrScoreFilter = [],
  setHrScoreFilter = () => { },
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
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  normalStyle,
                  "w-[140px]",
                  jobFilter.length > 0
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="truncate mr-auto text-left">
                  {jobFilter.length === 0
                    ? "All Jobs"
                    : jobFilter.length <= FILTER_DISPLAY_LIMIT
                      ? jobFilter.map(id => availableJobs.find(j => j.id === id)?.title || "Job").join(", ")
                      : `${jobFilter.slice(0, FILTER_DISPLAY_LIMIT).map(id => availableJobs.find(j => j.id === id)?.title || "Job").join(", ")} and ${jobFilter.length - FILTER_DISPLAY_LIMIT} more`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px] p-2 rounded-xl shadow-xl">
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
                {/* <DropdownMenuSeparator /> */}
                <div className="max-h-auto overflow-y-auto custom-scrollbar">
                  <DropdownMenuGroup>
                    {jobOptions.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                        No jobs found "{jobSearch}"
                      </div>
                    ) : (
                      <>
                        {jobOptions.slice(0, FILTER_DISPLAY_LIMIT).map((j) => (
                          <DropdownMenuCheckboxItem
                            key={j.id}
                            checked={jobFilter.includes(j.id)}
                            onSelect={(e) => e.preventDefault()}
                            onClick={() =>
                              setJobFilter(
                                jobFilter.includes(j.id)
                                  ? jobFilter.filter((v) => v !== j.id)
                                  : [...jobFilter, j.id]
                              )
                            }
                            className="rounded-lg truncate pr-1"
                          >
                            <HoverCard>
                              <HoverCardTrigger delay={10} closeDelay={10}>
                                <div className="truncate w-full">
                                  <span className="capitalize truncate">
                                    {j.title}
                                  </span>
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-64 p-2 rounded-lg" side="right" sideOffset={40}>
                                <div className="text-sm font-medium mb-0.5 capitalize">{j.title}</div>
                              </HoverCardContent>
                            </HoverCard>
                          </DropdownMenuCheckboxItem>
                        ))}
                        {jobOptions.length > FILTER_DISPLAY_LIMIT && (
                          <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                            And {jobOptions.length - FILTER_DISPLAY_LIMIT} more jobs...
                          </div>
                        )}
                      </>
                    )}
                  </DropdownMenuGroup>
                </div>
                {jobFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setJobFilter([])}
                      className="rounded-lg"
                    >
                      Clear jobs
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Location dropdown */}
          {showLocationFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  normalStyle,
                  "w-[130px]",
                  locationFilter.length > 0
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="truncate text-left">
                  {locationFilter.length === 0
                    ? "Locations"
                    : locationFilter.length <= FILTER_DISPLAY_LIMIT
                      ? locationFilter.join(", ")
                      : `${locationFilter.slice(0, FILTER_DISPLAY_LIMIT).join(", ")} and ${locationFilter.length - FILTER_DISPLAY_LIMIT} more`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[160px] p-2 rounded-xl shadow-xl">
                <div className="px-1 pb-2">
                  <div className="relative">
                    <Input
                      placeholder="Search locations..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="h-9 rounded-lg text-xs pl-2"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-auto overflow-y-auto custom-scrollbar">
                  <DropdownMenuGroup>
                    {locationOptions.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                        No locations found "{locationSearch}"
                      </div>
                    ) : (
                      <>
                        {locationOptions.slice(0, FILTER_DISPLAY_LIMIT).map((l) => (
                          <DropdownMenuCheckboxItem
                            key={l}
                            checked={locationFilter.includes(l)}
                            onSelect={(e) => e.preventDefault()}
                            onClick={() =>
                              setLocationFilter(
                                locationFilter.includes(l)
                                  ? locationFilter.filter((v) => v !== l)
                                  : [...locationFilter, l]
                              )
                            }
                            className="rounded-lg pl-2 pr-6"
                          >
                            {l}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {locationOptions.length > FILTER_DISPLAY_LIMIT && (
                          <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                            And {locationOptions.length - FILTER_DISPLAY_LIMIT} more locations...
                          </div>
                        )}
                      </>
                    )}
                  </DropdownMenuGroup>
                </div>
                {locationFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setLocationFilter([])}
                      className="rounded-lg"
                    >
                      Clear locations
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* HR Decision multi-select dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                normalStyle,
                "w-[130px]",
                hrDecisionFilter.length > 0
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className="truncate">
                {hrDecisionFilter.length === 0
                  ? "Decisions"
                  : hrDecisionFilter.length === 1
                    ? hrDecisionOptions.find((d) => d.value === hrDecisionFilter[0])?.label ?? hrDecisionFilter[0]
                    : `${hrDecisionFilter.length} Decisions`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-fit min-w-[130px] rounded-xl shadow-lg p-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">HR Decision</DropdownMenuLabel>
                {hrDecisionOptions.length === 0 ? (
                  <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                    No decisions in current data
                  </div>
                ) : hrDecisionOptions.map((d) => (
                  <DropdownMenuCheckboxItem
                    key={d.value}
                    checked={hrDecisionFilter.includes(d.value)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      setHrDecisionFilter(
                        hrDecisionFilter.includes(d.value)
                          ? hrDecisionFilter.filter((v) => v !== d.value)
                          : [...hrDecisionFilter, d.value]
                      )
                    }
                    className="rounded-lg pl-2 pr-6"
                  >
                    {d.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {hrDecisionFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setHrDecisionFilter([])}
                      className="rounded-lg"
                    >
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* resume screening result dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                normalStyle,
                "w-[130px]",
                resultFilter.length > 0
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className="truncate">
                {resultFilter.length === 0
                  ? "AI Result"
                  : resultFilter.length === 1
                    ? resultOptions.find((d) => d.value === resultFilter[0])?.label ?? resultFilter[0]
                    : `${resultFilter.length} Results`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-fit min-w-[130px] rounded-xl shadow-lg p-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">AI Result</DropdownMenuLabel>
                {resultOptions.length === 0 ? (
                  <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                    No results in current data
                  </div>
                ) : resultOptions.map((d) => (
                  <DropdownMenuCheckboxItem
                    key={d.value}
                    checked={resultFilter.includes(d.value)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      setResultFilter(
                        resultFilter.includes(d.value)
                          ? resultFilter.filter((v) => v !== d.value)
                          : [...resultFilter, d.value]
                      )
                    }
                    className="rounded-lg pl-2 pr-6"
                  >
                    {d.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {resultFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setResultFilter([])}
                      className="rounded-lg"
                    >
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Score Rating multi-select dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                normalStyle,
                "w-[130px]",
                hrScoreFilter.length > 0
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className="truncate">
                {hrScoreFilter.length === 0
                  ? "Score Rating"
                  : hrScoreFilter.length === 1
                    ? `Score: ${hrScoreFilter[0]}`
                    : `${hrScoreFilter.length} Ratings`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-fit min-w-[130px] rounded-xl shadow-lg p-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Score Rating</DropdownMenuLabel>
                {[1, 2, 3, 4, 5].map((score) => (
                  <DropdownMenuCheckboxItem
                    key={score}
                    checked={hrScoreFilter.includes(score)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      setHrScoreFilter(
                        hrScoreFilter.includes(score)
                          ? hrScoreFilter.filter((v) => v !== score)
                          : [...hrScoreFilter, score]
                      )
                    }
                    className="rounded-lg pl-2 pr-6"
                  >
                    {score}
                  </DropdownMenuCheckboxItem>
                ))}
                {hrScoreFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setHrScoreFilter([])}
                      className="rounded-lg"
                    >
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Stages multi-select dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                normalStyle,
                "w-[130px]",
                stageFilter.length > 0
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <span className="truncate">
                {stageFilter.length === 0
                  ? "Stages"
                  : stageFilter.length === 1
                    ? stageFilter[0]
                    : `${stageFilter.length} Stages`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-fit min-w-[130px] rounded-xl shadow-lg p-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Stages</DropdownMenuLabel>
                {stageOptions.length === 0 ? (
                  <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                    No stages available
                  </div>
                ) : (
                  <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                    {stageOptions.map((s) => (
                      <DropdownMenuCheckboxItem
                        key={s}
                        checked={stageFilter.includes(s)}
                        onSelect={(e) => e.preventDefault()}
                        onClick={() =>
                          setStageFilter(
                            stageFilter.includes(s)
                              ? stageFilter.filter((v) => v !== s)
                              : [...stageFilter, s]
                          )
                        }
                        className="rounded-lg pl-2 pr-6"
                      >
                        {s}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                )}
                {stageFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setStageFilter([])}
                      className="rounded-lg"
                    >
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hiring Activity multi-select dropdown */}
          {/* {activitySessionOptions && activitySessionOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center justify-between gap-2 h-10 px-3 w-[160px] rounded-xl border text-xs  cursor-pointer select-none transition-all",
                  activitySession.length > 0
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="truncate">
                  {activitySession.length === 0
                    ? "Hiring Cycle"
                    : activitySession.length === 1
                      ? `Activity ${activitySession[0]}`
                      : `${activitySession.length} Activities`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px] p-2 rounded-xl shadow-lg">
                <div className="px-1 pb-2">
                  <div className="relative">
                    <Input
                      placeholder="Search activity ids"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      className="h-9 rounded-lg text-xs pl-2"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-auto overflow-y-auto custom-scrollbar">
                  <DropdownMenuGroup>
                    {filteredActivityOptions.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                        No activities found "{activitySearch}"
                      </div>
                    ) : (
                      <>
                        {filteredActivityOptions.reverse().slice(0, FILTER_DISPLAY_LIMIT).map(([sessionId, dates]) => (
                          <DropdownMenuCheckboxItem
                            key={sessionId}
                            checked={activitySession.includes(String(sessionId))}
                            onSelect={(e) => e.preventDefault()}
                            onClick={() =>
                              setActivitySession(
                                activitySession.includes(String(sessionId))
                                  ? activitySession.filter((v) => v !== String(sessionId))
                                  : [...activitySession, String(sessionId)]
                              )
                            }
                            className="rounded-lg my-0.5"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-xs">Activity {sessionId}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {dates.start_date ? <DateDisplay date={dates.start_date} className="text-[10px]" /> : "N/A"} - {dates.end_date ? <DateDisplay date={dates.end_date} className="text-[10px]" /> : "Present"}
                              </span>
                            </div>
                          </DropdownMenuCheckboxItem>
                        ))}
                        {filteredActivityOptions.length > FILTER_DISPLAY_LIMIT && (
                          <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                            And {filteredActivityOptions.length - FILTER_DISPLAY_LIMIT} more activities...
                          </div>
                        )}
                      </>
                    )}
                  </DropdownMenuGroup>
                </div>
                {activitySession.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={false}
                      onClick={() => setActivitySession([])}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg"
                    >
                      Clear selection
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )} */}

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
