import { Clock } from "lucide-react";

type TotalDurationProps = {
    totalDuration: string;
}

export function TotalDuration({ totalDuration }: TotalDurationProps) {
    return <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg border border-border/40">
        <span className="text-xs flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Total Duration:
        </span>
        <span className="text-xs font-bold">
            {totalDuration}
        </span>
    </div>
}