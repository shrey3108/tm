import type { PriorityTimeline } from "@/types/admin";
import { Calendar, Clock, Timer, AlertCircle } from "lucide-react";
import DateDisplay from "@/components/shared/DateDisplay";
import { cn } from "@/lib/utils";
import { PRIORITY_TIMELINE_COLOR } from "@/constants";

interface ProgressBarChartProps {
    priorityTimeline?: PriorityTimeline | null
}
/**
 * Chart showing job priority timeline progress
 * @param priorityTimeline - Job priority timeline data
 * @returns JSX element
 */
export function ProgressBarChart({ priorityTimeline }: ProgressBarChartProps) {
    if (!priorityTimeline) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20 text-muted-foreground">
                <AlertCircle className="w-4 h-4 opacity-70" />
                <span className="text-xs font-semibold italic">No Priority Timeline</span>
            </div>
        );
    }
    const getPriorityTimelineColor = (progress_pct: number) => {
        const color = PRIORITY_TIMELINE_COLOR.find(
            (c) => progress_pct <= c.max && progress_pct >= c.min
        )?.color;
        return color;
    }


    const safeProgress = Math.min(Math.max(priorityTimeline.progress_pct, 0), 100);

    return (
        <div className="md:w-full h-auto flex flex-col justify-between p-0 sm:w-full">
            {/* Header Info */}
            <div className="flex items-center flex-col md:flex-row md:justify-between mb-0 gap-2">
                <div className="space-y-1 shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Timer className="w-5 h-5 text-primary" />
                        {priorityTimeline.name}
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground md:text-sm">
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md">
                                <Calendar className="w-3.5 h-3.5 text-primary/60" />
                                <DateDisplay date={priorityTimeline.start_date} className="text-xs md:text-sm" />
                            </span>
                            <span className="text-muted-foreground font-light">to</span>
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md">
                                <Clock className="w-3.5 h-3.5 text-orange-500/60" />
                                <DateDisplay date={priorityTimeline.due_date} className="text-xs md:text-sm" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar Container - Moved here */}
                <div className="flex-1 px-2 relative group md:w-full w-full">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs font-medium text-primary/80">Hiring Timeline:</span>
                    </div>
                    <div className="h-4 w-full bg-muted rounded-full overflow-hidden relative shadow-inner">
                        <div
                            className={cn(`${getPriorityTimelineColor(priorityTimeline.progress_pct)} h-full transition-all duration-1000 ease-out relative`)}
                            style={{ width: `${safeProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:flex-row shrink-0">
                    <div className="rounded-2xl p-0.5 text-center space-y-0 border w-24">
                        <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-lg font-black text-foreground">{priorityTimeline.days_total}</p>
                        </div>
                        <div className="flex items-center justify-center">
                            <span className="text-[10px] leading-tight font-bold text-muted-foreground px-1 uppercase tracking-tighter">
                                Total Days
                            </span>
                        </div>
                    </div>
                    <div className="rounded-2xl p-0.5 text-center space-y-0 border w-24">
                        <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-lg font-black ">{priorityTimeline.days_elapsed}</p>
                        </div>
                        <div className="flex items-center justify-center">
                            <span className="text-[10px] leading-tight font-bold text-muted-foreground px-1 uppercase tracking-tighter">
                                Days Passed
                            </span>
                        </div>
                    </div>
                    <div className="rounded-2xl p-0.5 text-center space-y-0 border w-24">
                        <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-lg font-black ">{priorityTimeline.days_remaining}</p>
                        </div>
                        <div className="flex items-center justify-center">
                            <span className="text-[10px] leading-tight font-bold text-muted-foreground px-1 uppercase tracking-tighter">
                                Remaining Days
                            </span>
                        </div>
                    </div>
                </div>
            </div>


            {/* Stats Footer */}

        </div>
    );
}