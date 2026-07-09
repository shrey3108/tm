import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CandidatesDistributionChart,
  StagesBarChart,
  LocationBarChart,
} from "@/components/shared/BarChart";
import { ProgressBarChart } from "@/components/shared/Progressbar";
import { ResultPieChart } from "@/components/shared/ResultPieChart";
import type { JobStatsResponse } from "@/types/admin";
import { CHART_TEXTS } from "@/constants";
import { ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { JobCandidatesStatsProps } from "./JobCandidatesStats";

interface JobCandidatesChartsProps {
  loading: boolean;
  isRefreshing: boolean;
  stats: JobCandidatesStatsProps;
  jobStats: JobStatsResponse | null;
}

/**
 * Extracts HR decision stats for a specific stage from jobStats.stage_details.
 * The API returns partial hr_decisions keys like "pass", "fail", "may be".
 */
function getStageHrStats(
  jobStats: JobStatsResponse | null,
  stageName: string,
): {
  totalCandidates: number;
  passedCount: number;
  failedCount: number;
  maybeCount: number;
  undecidedCount: number;
} | null {
  const stageDetail = jobStats?.stage_details?.[stageName];
  if (!stageDetail) return null;

  const hrDec = stageDetail.hr_decisions ?? {};
  const passedCount = hrDec["approve"] ?? hrDec["pass"] ?? 0;
  const failedCount = hrDec["reject"] ?? hrDec["fail"] ?? 0;
  const maybeCount = hrDec["may be"] ?? hrDec["maybe"] ?? 0;
  const pendingCount = hrDec["pending"] ?? 0;
  const totalCandidates = passedCount + failedCount + maybeCount + pendingCount;

  return { totalCandidates, passedCount, failedCount, maybeCount, undecidedCount: pendingCount };
}

/**
 * Extracts AI screening results for a specific stage from jobStats.stage_details.
 */
function getStageScreening(
  jobStats: JobStatsResponse | null,
  stageName: string,
): { passCount: number; failCount: number } | null {
  const stageDetail = jobStats?.stage_details?.[stageName];
  if (!stageDetail) return null;

  const aiResults = stageDetail.ai_results ?? {};
  return {
    passCount: aiResults.passed ?? 0,
    failCount: aiResults.failed ?? 0,
  };
}

export function JobCandidatesCharts({
  loading,
  isRefreshing,
  stats,
  jobStats,
}: JobCandidatesChartsProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const passCount = jobStats?.result?.passed ?? 0;
  const failCount = jobStats?.result?.failed ?? 0;


  // Determine the HR decision stats and screening results based on selected stage
  const stageHrStats = selectedStage ? getStageHrStats(jobStats, selectedStage) : null;
  const activeHrStats = stageHrStats ?? stats;

  const stageScreening = selectedStage ? getStageScreening(jobStats, selectedStage) : null;
  const activeScreening = stageScreening ?? { passCount, failCount };

  const handleStageClick = (stageName: string) => {
    // Toggle: clicking the same stage again deselects it
    setSelectedStage((prev) => (prev === stageName ? null : stageName));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in duration-700">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-100 rounded-3xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  const stagesList = [...Object.keys(jobStats?.stages || {})];
  const StageSelector = (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-between gap-2 h-10 px-3 w-50 rounded-xl border text-sm font-medium cursor-pointer select-none transition-all truncate">
        <span className="truncate">{selectedStage ?? "Resume Screening"}</span>
        <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1.5">
            Stages
          </DropdownMenuLabel>
          {stagesList.map((stage) => {
            return (
              <DropdownMenuCheckboxItem
                checked={stage === selectedStage}
                key={stage}
                className="rounded-lg my-0.5 capitalize"
                onClick={() => handleStageClick(stage)}
                onSelect={(e) => e.preventDefault()}
              >
                {stage}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const obj: {
    title: string;
    description: string;
    chart: React.JSX.Element;
    takeFullSpace?: boolean;
    action?: React.ReactNode;
    haveBorder?: boolean
  }[] = [
      {
        title: CHART_TEXTS.hrDecision.label,
        description: selectedStage
          ? `HR decisions for "${selectedStage}" stage`
          : CHART_TEXTS.hrDecision.description,
        chart: <CandidatesDistributionChart stats={activeHrStats as JobCandidatesStatsProps} />,
        action: StageSelector,
        haveBorder: true,
      },
      {
        title: CHART_TEXTS.screeningResults.label,
        description: selectedStage
          ? `AI results for "${selectedStage}" stage`
          : CHART_TEXTS.screeningResults.description,
        chart: (
          <ResultPieChart
            passCount={activeScreening.passCount}
            failCount={activeScreening.failCount}
          />
        ),
        action: StageSelector,
      },
      {
        title: CHART_TEXTS.recruitmentStages.label,
        description: CHART_TEXTS.recruitmentStages.description,
        chart: (
          <StagesBarChart
            stages={jobStats?.stages || {}}
            onStageClick={handleStageClick}
            selectedStage={selectedStage}
          />
        ),
        takeFullSpace: true,
      },
      {
        title: CHART_TEXTS.locations.label,
        description: CHART_TEXTS.locations.description,
        chart: <LocationBarChart locations={jobStats?.location || {}} />,
        takeFullSpace: true,
      },
    ];
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700",
        isRefreshing && "opacity-60 transition-opacity duration-300",
      )}
    >
      {/* Stage filter indicator */}
      {selectedStage && (
        <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-primary/10 border border-primary/20 text-sm font-semibold text-primary">
            <span>Filtering by stage:</span>
            <span className="font-black">{selectedStage}</span>
            <Button
              onClick={() => setSelectedStage(null)}
              variant={"ghost"}
              size={"icon"}
              className="text-primary hover:text-destructive cursor-pointer"
              title="Clear stage filter"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {/* Priority Timeline Section */}
      <div className="group overflow-hidden relative w-full p-0.5 sm:col-span-2 animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="flex items-center justify-between gap-6 mb-2 border-b border-muted-foreground/10 pb-4">
          <h4 className="font-black text-lg text-foreground tracking-tight capitalize">
            {CHART_TEXTS.priorityTimeline.label}
          </h4>
          <div className="flex-1 flex items-center justify-end animate-in fade-in slide-in-from-right-2 duration-500">
            <ProgressBarChart priorityTimeline={jobStats?.priority_timeline || null} />
          </div>
        </div>
      </div>
      {obj.map(({ chart, title, takeFullSpace, action, haveBorder }) => (
        <div
          className={cn(
            "group overflow-hidden relative w-full p-0.5",
            takeFullSpace && "sm:col-span-2 w-full",
            haveBorder && "border-r border-r-muted-foreground",
          )}
          key={title}
        >
          <div className="flex items-center justify-between gap-1 mb-2 border-b border-muted-foreground/10 pb-4">
            <div>
              <h4 className="font-black text-lg text-foreground tracking-tight capitalize">
                {title}
              </h4>
              {/* <p className="text-sm text-muted-foreground font-medium">{description}</p> */}
            </div>
            {action && (
              <div className="flex items-center animate-in fade-in slide-in-from-right-2 duration-500">
                {action}
              </div>
            )}
          </div>
          <div className="w-full min-h-25 max-h-75">{chart}</div>
        </div>
      ))}
    </div>
  );
}
