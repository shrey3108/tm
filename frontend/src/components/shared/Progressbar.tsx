import type { PriorityTimeline } from "@/types/admin";
import { Calendar, Clock, Timer, AlertCircle } from "lucide-react";
import DateDisplay from "@/components/shared/DateDisplay";
import { cn } from "@/lib/utils";

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
            <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-3xl p-6 text-center space-y-3 bg-muted/5">
                <div className="p-3 bg-muted/20 rounded-full">
                    <AlertCircle className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground font-semibold italic">No Priority Timeline</p>
                    <p className="text-xs text-muted-foreground/60 max-w-[200px]">Assign a priority to this job to track its progress timeline.</p>
                </div>
            </div>
        );
    }
    const getColor = (p: number) => {
        if (p <= 10) return "bg-green-500";
        if (p <= 30) return "bg-blue-500";
        if (p < 50) return "bg-yellow-500";
        if (p < 70) return "bg-orange-500";
        return "bg-red-500";
    };

    const safeProgress = Math.min(Math.max(priorityTimeline.progress_pct, 0), 100);

    return (
        <div className="md:w-full h-auto flex flex-col justify-between p-1 sm:w-full">
            {/* Header Info */}
            <div className="flex items-center md:justify-between mb-1 gap-6">
                <div className="space-y-1 shrink-0">
                    <h5 className="text-lg font-bold flex items-center gap-2">
                        <Timer className="w-5 h-5 text-primary" />
                        {priorityTimeline.name}
                    </h5>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-md">
                            <Calendar className="w-3.5 h-3.5 text-primary/60" />
                            <DateDisplay date={priorityTimeline.start_date} />
                        </span>
                        <span className="text-muted-foreground font-light">to</span>
                        <span className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-md">
                            <Clock className="w-3.5 h-3.5 text-orange-500/60" />
                            <DateDisplay date={priorityTimeline.due_date} />
                        </span>
                    </div>
                </div>

                {/* Progress Bar Container - Moved here */}
                <div className="flex-1 px-4 relative group">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-medium text-primary ">Hiring Timeline:</span>
                    </div>
                    <div className="h-4 w-full bg-muted rounded-full overflow-hidden relative shadow-inner">
                        <div
                            className={cn(`
                  ${getColor(priorityTimeline.progress_pct)} h-full transition-all duration-1000 ease-out relative`)}
                            style={{ width: `${safeProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:flex-col md:flex-row shrink-0">
                    <div className="rounded-2xl p-0.5 text-center space-y-0.5 border w-25 ">
                        <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-xl font-black text-foreground">{priorityTimeline.days_total}</p>
                        </div>
                        <div className="min-h-10 flex items-center justify-center mt-1">
                            <span className="text-xs leading-tight font-bold text-muted-foreground px-1">
                                Total Days
                            </span>
                        </div>
                    </div>
                    <div className="rounded-2xl p-0.5 text-center space-y-0.5 border w-25">
                        <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-xl font-black ">{priorityTimeline.days_elapsed}</p>
                        </div>
                        <div className="min-h-10 flex items-center justify-center mt-1">
                            <span className="text-xs leading-tight font-bold text-muted-foreground px-1">
                                Days Passed
                            </span>
                        </div>
                    </div>
                    <div className="rounded-2xl p-0.5 text-center space-y-0.5 border w-25">
                        <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-xl font-black ">{priorityTimeline.days_remaining}</p>
                        </div>
                        <div className="min-h-10 flex items-center justify-center mt-1">
                            <span className="text-xs leading-tight font-bold text-muted-foreground px-1">
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