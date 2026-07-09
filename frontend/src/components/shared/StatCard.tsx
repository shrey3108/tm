import { type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "../ui/card";

/**
 * Props for the StatCard component.
 */
interface StatCardProps {
  /** Label describing the statistic */
  label: string;
  /** The numeric or text value to display */
  value: string | number;
  /** Optional icon to display next to the label */
  icon?: ReactNode;
  /** Whether the stat is currently loading */
  loading?: boolean;
  /** Optional trend indicator showing percentage change */
  trend?: {
    /** The percentage value of the trend */
    value: number;
    /** Whether the trend is positive (up) or negative (down) */
    isUp: boolean;
  };
  /** Additional CSS class name */
  className?: string;
}

/**
 * Statistics card displaying a metric with optional trend.
 */
const StatCard = ({ label, value, icon, loading, trend, className = "" }: StatCardProps) => {
  return (
    <Card className={`border-0 shadow-md rounded-2xl aspect-square flex flex-col transition-all hover:shadow-lg min-h-25  max-h-37.5 flex-1 p-2 ${className}`}>
      <CardContent className="p-2 flex flex-col h-full text-center">
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          {icon && <span className="text-primary text-xl mb-1">{icon}</span>}
          {loading ? (
            <Skeleton className="h-10 w-16 rounded-lg" />
          ) : (
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight">{value}</h2>
          )}
          {trend && !loading && (
            <Badge variant={trend.isUp ? "default" : "destructive"} className="mt-1 font-medium text-[10px] py-0 h-4">
              {trend.isUp ? "↑" : "↓"} {trend.value}%
            </Badge>
          )}
        </div>
        <div className="min-h-10 flex items-center justify-center mt-1">
          <span className="text-xs leading-tight font-bold text-muted-foreground px-1 ">
            {label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
