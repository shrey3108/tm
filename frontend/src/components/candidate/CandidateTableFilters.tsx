import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Filter, Search, Star } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Separator } from "@/components/ui/separator";
import { useMemo, useState } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import { CollapsibleFilterSection, CheckboxListFilter } from "@/components/shared/FilterComponents";
import type { Job } from "@/types/job";


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
  hrScoreFilter?: number[];
  setHrScoreFilter?: (value: number[]) => void;
  testEmailSentFilter?: string;
  setTestEmailSentFilter?: (value: string | undefined) => void;
  isTestPaperFilterEnabled?: boolean;
  job?: Job | null;
  /** Optional action buttons rendered right-aligned inside the filter bar */
  actions?: React.ReactNode;
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
  // setLocationSearch,
  jobOptions,
  // setJobSearch,
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
  hrScoreFilter = [],
  setHrScoreFilter = () => { },
  testEmailSentFilter,
  setTestEmailSentFilter = () => { },
  isTestPaperFilterEnabled = false,
  actions,
}: CandidateTableFiltersProps) => {

  const [hoverValue, setHoverValue] = useState<number | null>(0);

  const formattedJobOptions = useMemo(() => {
    return jobOptions.map((j) => ({
      id: j.id,
      label: j.title,
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (jobFilter.length > 0) count++;
    if (locationFilter.length > 0) count++;
    if (hrDecisionFilter.length > 0) count++;
    if (resultFilter.length > 0) count++;
    if (hrScoreFilter.length > 0) count++;
    if (stageFilter.length > 0) count++;
    if (testEmailSentFilter !== undefined) count++;
    if (dateRange?.from || dateRange?.to) count++;
    return count;
  }, [
    jobFilter,
    locationFilter,
    hrDecisionFilter,
    resultFilter,
    hrScoreFilter,
    stageFilter,
    testEmailSentFilter,
    dateRange,
  ]);

  return (
    <div className="flex flex-col gap-2 my-4 p-2 bg-muted/20 rounded-2xl border border-muted-foreground/10 overflow-hidden">
      <div className="flex flex-col lg:flex-row items-center gap-2 w-full">
        {/* Search & Filter Trigger Area */}
        <div className="flex flex-wrap items-center gap-2 flex-1 w-full lg:w-auto">
          {/* Search Field */}
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Search name or email…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="h-10 rounded-xl border-border/70 bg-background/90 pl-9 transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Sheet Trigger */}
          <Sheet>
            <SheetTrigger type="button" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2 px-3 border border-muted-foreground/20 hover:bg-muted/10 bg-background transition-all cursor-pointer")}>

              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-5 h-5 px-1 ml-1 animate-in zoom-in duration-200">
                  {activeFilterCount}
                </span>
              )}

            </SheetTrigger>

            <SheetContent className="w-full sm:max-w-md flex flex-col h-full p-0 bg-background border-l shadow-2xl" showCloseButton={false}>
              {/* Header */}
              <SheetHeader className="px-3 py-2 border-b border-muted/20 flex flex-row items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  <Filter className="h-4.5 w-4.5" />
                  <SheetTitle className="font-semibold text-base text-foreground">
                    Filters
                  </SheetTitle>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearFilters}>
                    Clear All
                  </Button>
                )}
              </SheetHeader>

              {/* Scrollable Filters */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {/* Jobs Filter */}
                {showJobContext && (
                  <CollapsibleFilterSection title="Jobs" count={jobFilter.length}>
                    <CheckboxListFilter
                      options={formattedJobOptions}
                      selectedValues={jobFilter}
                      onChange={setJobFilter}
                      idPrefix="job"
                      emptyText="No jobs found"
                    />
                  </CollapsibleFilterSection>
                )}

                {/* Locations Filter */}
                {showLocationFilter && (
                  <CollapsibleFilterSection title="Locations" count={locationFilter.length}>
                    <CheckboxListFilter
                      options={formattedLocationOptions}
                      selectedValues={locationFilter}
                      onChange={setLocationFilter}
                      idPrefix="location"
                      emptyText="No locations found"
                    />
                  </CollapsibleFilterSection>
                )}


                {/* HR Decisions Filter */}
                <CollapsibleFilterSection title="HR Decisions" count={hrDecisionFilter.length}>
                  <CheckboxListFilter
                    options={formattedHrDecisionOptions}
                    selectedValues={hrDecisionFilter}
                    onChange={setHrDecisionFilter}
                    idPrefix="decision"
                    showSearchMore={false}
                  />
                </CollapsibleFilterSection>

                {/* AI Results Filter */}
                <CollapsibleFilterSection title="AI Resume Screening" count={resultFilter.length}>
                  <CheckboxListFilter
                    options={formattedResultOptions}
                    selectedValues={resultFilter}
                    onChange={setResultFilter}
                    idPrefix="result"
                    showSearchMore={false}
                  />
                </CollapsibleFilterSection>

                {/* Score Rating Filter */}
                <CollapsibleFilterSection title="Score Rating" count={hrScoreFilter.length}>
                  <div className="flex items-center justify-center py-2.5">
                    <div
                      className="flex items-center gap-1 cursor-pointer"
                      onMouseLeave={() => setHoverValue(null)}
                    >
                      {Array.from({ length: 5 }).map((_, index) => {
                        const starValue = index + 1;
                        const activeValue = hoverValue !== null ? hoverValue : (hrScoreFilter[0] ?? 0);
                        let fillType: "full" | "half" | "empty" = "empty";

                        if (activeValue >= starValue) {
                          fillType = "full";
                        } else if (activeValue === starValue - 0.5) {
                          fillType = "half";
                        }

                        const leftVal = Math.max(1, starValue - 0.5);
                        const rightVal = starValue;

                        return (
                          <div
                            key={index}
                            className="relative w-8 h-8 select-none transition-transform active:scale-95 duration-100"
                          >
                            {/* Left half hit zone */}
                            <div
                              className="absolute top-0 left-0 w-1/2 h-full cursor-pointer z-10"
                              onMouseEnter={() => setHoverValue(leftVal)}
                              onClick={() => {
                                if (hrScoreFilter.includes(leftVal)) {
                                  setHrScoreFilter([]);
                                } else {
                                  setHrScoreFilter([leftVal]);
                                }
                              }}
                            />
                            {/* Right half hit zone */}
                            <div
                              className="absolute top-0 right-0 w-1/2 h-full cursor-pointer z-10"
                              onMouseEnter={() => setHoverValue(rightVal)}
                              onClick={() => {
                                if (hrScoreFilter.includes(rightVal)) {
                                  setHrScoreFilter([]);
                                } else {
                                  setHrScoreFilter([rightVal]);
                                }
                              }}
                            />

                            {/* Background empty star */}
                            <Star className="w-8 h-8 text-muted-foreground/30 fill-none" />

                            {/* Full star overlay */}
                            {fillType === "full" && (
                              <Star className="absolute top-0 left-0 w-8 h-8 text-[#E17100] fill-[#FFB900]" />
                            )}

                            {/* Half star overlay */}
                            {fillType === "half" && (
                              <Star
                                className="absolute top-0 left-0 w-8 h-8 text-[#E17100] fill-[#FFB900]"
                                style={{ clipPath: "inset(0 50% 0 0)" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="min-w-7">
                      {(hrScoreFilter.length > 0 || hoverValue !== null) && (
                        <span className="px-1.5 py-0.5 rounded-md bg-[#F9EBE1] text-[#E17100] text-xs font-bold min-w-7 text-center">
                          {(hoverValue !== null ? hoverValue : hrScoreFilter[0]).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                </CollapsibleFilterSection>

                {/* Stages Filter */}
                <CollapsibleFilterSection title="Stages" count={stageFilter.length}>
                  <CheckboxListFilter
                    options={formattedStageOptions}
                    selectedValues={stageFilter}
                    onChange={setStageFilter}
                    idPrefix="stage"
                    emptyText="No stages available"
                    searchPlaceholder="Search more stages..."
                  />
                </CollapsibleFilterSection>

                {/* Test Email Filter */}
                <CollapsibleFilterSection title="Test Email Status" count={testEmailSentFilter !== undefined ? 1 : 0}>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant={"outline"}
                      disabled={!isTestPaperFilterEnabled}
                      onClick={() =>
                        setTestEmailSentFilter(
                          testEmailSentFilter === "sent" ? undefined : "sent"
                        )
                      }
                      className={cn(
                        testEmailSentFilter === "sent"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-transparent text-muted-foreground",
                        !isTestPaperFilterEnabled &&
                        "opacity-50 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      Sent
                    </Button>
                    <Button
                      type="button"
                      variant={"outline"}
                      disabled={!isTestPaperFilterEnabled}
                      onClick={() =>
                        setTestEmailSentFilter(
                          testEmailSentFilter === "not_sent" ? undefined : "not_sent"
                        )
                      }
                      className={cn(
                        testEmailSentFilter === "not_sent"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-transparent text-muted-foreground",
                        !isTestPaperFilterEnabled &&
                        "opacity-50 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      Not Sent
                    </Button>
                  </div>
                  {!isTestPaperFilterEnabled && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Enable by selecting a Technical Practical stage and "Pending" status.
                    </p>
                  )}
                </CollapsibleFilterSection>

                {/* Applied Date Range Filter */}
                <CollapsibleFilterSection
                  title={
                    <span className="flex items-center gap-2">
                      Uploaded Date Range
                      {dateRange?.from && (
                        <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full truncate">
                          {format(dateRange.from, "MMM d")}
                          {dateRange.to ? ` - ${format(dateRange.to, "MMM d")}` : ""}
                        </span>
                      )}
                    </span>
                  }
                  titleClassName="max-w-[85%]"
                >
                  <div className="flex justify-center rounded-xl mt-1">
                    <Calendar
                      required
                      autoFocus={false}
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                      disabled={{ after: new Date(), before: minDate }}
                      buttonVariant="ghost"
                      captionLayout="label"
                      className="w-full rounded-xl"
                    />
                  </div>
                </CollapsibleFilterSection>
              </div>

              <SheetFooter>
                {/* Footer */}
                <SheetClose
                  render={
                    <Button>
                      {hasActiveFilters ? <span>Apply & Close</span> : <span>Close</span>}
                    </Button>
                  }
                />
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {actions && (
            <div className="shrink-0 flex items-center">
              {actions}
            </div>
          )}
        </div>



        {/* Result Count Area (Anchored Right) */}
        <div className="shrink-0 lg:ml-auto text-xs font-medium flex items-center gap-2 p-2 border rounded-xl bg-background/50 h-10 self-start">
          <div className="text-xs font-medium flex items-center gap-2 justify-self-center px-2">
            <span>Total</span>
            <span className="font-bold">{totalCount}</span> Candidates
            <Separator orientation="vertical" className="h-4 bg-gray-700 dark:bg-gray-300" />
            <span className="font-bold">{resultCount}</span> Candidates found
          </div>
        </div>
      </div>
    </div>
  );
};
