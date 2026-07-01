import React from "react";
import { cn } from "@/lib/utils";

interface InfoLabelProps {
  label: string;
  value: React.ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

/**
 * InfoLabel component for displaying data in a "Label : Value" format.
 */
export const InfoLabel = ({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: InfoLabelProps) => {
  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <span
        className={cn(
          "text-sm font-black",
          labelClassName
        )}
      >
        {label}
      </span>
      <span className="text-muted-foreground/30 font-light">:</span>
      <span
        className={cn(
          "text-sm font-bold text-foreground/90 ",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
};

export default InfoLabel;
