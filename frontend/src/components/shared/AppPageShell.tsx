import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppPageShellWidth = "form" | "default" | "wide" | "full";

interface AppPageShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  width?: AppPageShellWidth;
  gap?: "tight" | "default" | "loose";
}

const widthClasses: Record<AppPageShellWidth, string> = {
  form: "max-w-4xl",
  default: "max-w-none",
  wide: "max-w-none",
  full: "max-w-none",
};

const gapClasses = {
  tight: "gap-1.5 md:gap-2",
  default: "gap-2 md:gap-3",
  loose: "gap-3 md:gap-4",
};

export default function AppPageShell({
  children,
  className,
  contentClassName,
  width = "full",
  gap = "tight",
}: AppPageShellProps) {
  return (
    <section
      className={cn(
        "w-full px-1 pb-2 pt-2 sm:px-2 md:px-2 md:pb-1.5 md:pt-1 lg:px-3 lg:pb-2",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col",
          widthClasses[width],
          gapClasses[gap],
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
