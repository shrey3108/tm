import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";

interface AppPageHeaderAction {
  label: string;
  onClick: () => void;
}

interface AppPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  backAction?: AppPageHeaderAction;
  className?: string;
  contentClassName?: string;
  headingClassName?: string;
  breadcrumbActions?: ReactNode;
}

export default function AppPageHeader({
  title,
  subtitle,
  breadcrumbs = <DashboardBreadcrumbs />,
  meta,
  actions,
  className,
  contentClassName,
  headingClassName,
  breadcrumbActions,
}: AppPageHeaderProps) {
  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full",
          "bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60",
          "border-b border-border/50 shadow-xs",
          className
        )}
      >
        <div className={cn("px-1 py-2 flex flex-col gap-2", contentClassName)}>
          {/* Navbar Layer: Title and Actions */}
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex flex-col min-w-0 overflow-hidden">
                <h1
                  className={cn(
                    "font-bold tracking-tight text-foreground truncate",
                    headingClassName
                  )}
                >
                  {title}
                </h1>
              </div>
            </div>

            {actions && (
              <div className="flex shrink-0 items-center gap-2">
                {actions}
              </div>
            )}
          </div>

          {/* Supplementary Layer: Subtitle and Meta */}
          {(subtitle || meta) && (
            <div className="flex flex-col gap-2 items-center justify-center sm:items-start sm:justify-start">
              {subtitle && (
                <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
                  {subtitle}
                </p>
              )}
              {meta && (
                <div className="flex flex-wrap items-center gap-2">
                  {meta}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Breadcrumbs Label Row */}
      {(breadcrumbs || breadcrumbActions) && (
        <div className="px-1.5 py-1 border-b border-border/40 bg-muted/5 mb-0.5 flex items-center justify-between gap-4 h-9">
          <div className="hidden sm:block overflow-hidden flex-1 max-w-fit">
            {breadcrumbs}
          </div>
          {breadcrumbActions && (
            <div className="flex shrink-0 items-center gap-2">
              {breadcrumbActions}
            </div>
          )}
        </div>
      )}
    </>
  );
}
