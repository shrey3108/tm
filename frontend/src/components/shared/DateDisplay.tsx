/**
 * Component for displaying formatted dates with customization options.
 * Supports various input formats, custom formatters, and fallback text.
 */

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

/**
 * Props for the DateDisplay component.
 */
interface DateDisplayProps {
  /** Date value to display (string, number, or Date object) */
  date?: string | number | Date | null;
  /** Whether to show date part (default: true) */
  showDate?: boolean;
  /** Whether to show time along with date (default: false) */
  showTime?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Fallback text to display when date is invalid or null (default: 'N/A') */
  fallback?: string;
  /** Custom Intl.DateTimeFormat options for formatting */
  formatOptions?: Intl.DateTimeFormatOptions;
  /** Custom formatter function to convert Date to string */
  formatter?: (date: Date) => string;
  /** Whether to show a calendar icon (default: false) */
  showIcon?: boolean;
  /** Whether to return null instead of fallback if date is missing (default: false) */
  hideIfEmpty?: boolean;
  /** Whether to show title attribute (default: false) */
  showTitle?: boolean;
}

/**
 * Internal component for rendering the formatted date.
 * Relies on ErrorBoundary for catching unexpected formatting errors.
 */
const DateDisplayContent = ({
  date,
  showDate = true,
  showTime = false,
  className = "",
  fallback = "N/A",
  formatOptions,
  formatter,
  showIcon = false,
  hideIfEmpty = false,
  showTitle = false,
}: DateDisplayProps) => {
  if (!date) {
    if (hideIfEmpty) return null;
    return (
      <span className={cn("text-muted-foreground italic text-sm", className)}>{fallback}</span>
    );
  }

  const dateObj = new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return (
      <span className={cn("text-muted-foreground italic text-sm", className)}>{fallback}</span>
    );
  }

  let formattedDate = "";
  if (formatter) {
    formattedDate = formatter(dateObj);
  } else if (formatOptions) {
    formattedDate = dateObj.toLocaleString(undefined, formatOptions);
  } else {
    if (showDate) {
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = dateObj.toLocaleString("en-GB", { month: "short" });
      const year = dateObj.getFullYear();
      formattedDate = `${day}-${month}-${year}`;
    }

    if (showTime) {
      const time = dateObj.toLocaleString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      formattedDate = formattedDate ? `${formattedDate} ${time}` : time;
    }
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm", className)}
      {...showTitle ? { title: dateObj.toString() } : {}}
    >
      {showIcon && <Calendar className="h-3.5 w-3.5" />}
      {formattedDate}
    </span>
  );
};

/**
 * Displays a formatted date string with customizable formatting.
 * Wrapped in an ErrorBoundary to catch rendering/formatting errors.
 *
 * @example
 * ```tsx
 * <DateDisplay date="2024-03-15T10:30:00Z" />
 * ```
 */
export const DateDisplay = (props: DateDisplayProps) => {
  const { className = "", fallback = "N/A" } = props;

  const errorFallback = (
    <span className={cn("text-destructive font-medium text-sm", className)}>{fallback}</span>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <DateDisplayContent {...props} />
    </ErrorBoundary>
  );
};

export default DateDisplay;
