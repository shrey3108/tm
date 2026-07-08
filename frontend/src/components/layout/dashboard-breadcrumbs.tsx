import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";
import {
  Home,
  Briefcase,
  Users,
  PlusCircle,
  Settings,
  ShieldCheck,
  FileText,
  BarChart3,
  UserCog,
  ScrollText,
  Upload,
  Sparkles,
  GitBranch,
  ChevronRight,
  Building2,
  ListChecks,
  Layers,
  ListTodo,
  type LucideIcon,
  ReceiptText,
  User,
  PencilIcon
} from "lucide-react";

/**
 * Route metadata mapping: maps URL segments to display labels and icons.
 * Unmapped segments (dynamic IDs/slugs) are hidden to keep breadcrumbs clean.
 */
const ROUTE_META: Record<string, { label: string; icon?: LucideIcon }> = {
  // Core Segments 
  dashboard: { label: "Home", icon: Home },
  jobs: { label: "Jobs", icon: Briefcase },
  candidates: { label: "Candidates", icon: Users },
  new: { label: "Create Job", icon: PlusCircle },
  edit: { label: "Edit", icon: PencilIcon },
  versions: { label: "Versions", icon: GitBranch },
  admin: { label: "Admin Dashboard", icon: ShieldCheck },
  departments: { label: "Departments", icon: Building2 },
  users: { label: "Users", icon: UserCog },
  roles: { label: "Roles", icon: ShieldCheck },
  skills: { label: "Skills", icon: Sparkles },
  "audit-logs": { label: "Audit Logs", icon: ScrollText },
  "recent-uploads": { label: "Recent Uploads", icon: Upload },
  stats: { label: "Statistics", icon: BarChart3 },
  profile: { label: "Profile", icon: UserCog },
  settings: { label: "Settings", icon: Settings },
  priorities: { label: "Priorities", icon: ListTodo },
  prompts: { label: "Prompts", icon: ReceiptText },
  "terms-conditions": { label: "Terms & Conditions", icon: ScrollText },
  "criteria-stages": { label: "Job Config", icon: Settings },
  criteria: { label: "Job Criteria", icon: ListChecks },
  stages: { label: "Job Stages", icon: Layers },
  positions: { label: "Job Positions", icon: User },
  "questions-bank": { label: "Questions Bank", icon: ListChecks },
  transcript: { label: "Transcript", icon: ScrollText },
  associates: { label: "Associates", icon: Users },
  "assign-associate": { label: "Assign Associate", icon: UserCog },

  //  Path-Specific Context Overrides 
  "dashboard/admin/departments/new": { label: "Create Department", icon: PlusCircle },
  "dashboard/admin/departments/*/edit": { label: "Edit Department", icon: PencilIcon },
  "dashboard/admin/skills/new": { label: "Create Skill", icon: PlusCircle },
  "dashboard/admin/skills/*/edit": { label: "Edit Skill", icon: PencilIcon },
  "dashboard/admin/settings/priorities/new": { label: "Create Priority", icon: PlusCircle },
  "dashboard/admin/settings/priorities/*/edit": { label: "Edit Priority", icon: PencilIcon },
  "dashboard/admin/settings/terms-conditions/new": { label: "Create Term & Condition", icon: PlusCircle },
  "dashboard/admin/settings/terms-conditions/*/edit": { label: "Edit Term & Condition", icon: PencilIcon },
  "dashboard/admin/criteria-stages/positions/new": { label: "Create Position", icon: PlusCircle },
  "dashboard/admin/criteria-stages/positions/*/edit": { label: "Edit Position", icon: PencilIcon },
  "dashboard/admin/associates/new": { label: "Create Associate", icon: PlusCircle },
  "dashboard/admin/associates/*/edit": { label: "Edit Associate", icon: PencilIcon },
  "dashboard/admin/users/new": { label: "Create User", icon: PlusCircle },
  "dashboard/admin/users/*/edit": { label: "Edit User", icon: PencilIcon },
  "dashboard/admin/roles/new": { label: "Create Role", icon: PlusCircle },
  "dashboard/admin/roles/*/edit": { label: "Edit Role", icon: PencilIcon },
  // Job Criteria Forms
  "dashboard/admin/criteria-stages/criteria/new": { label: "Create Criteria", icon: PlusCircle },
  "dashboard/admin/criteria-stages/criteria/*/edit": { label: "Edit Criteria", icon: PencilIcon },
  // Job Stages Forms
  "dashboard/admin/criteria-stages/stages/new": { label: "Create Stage", icon: PlusCircle },
  "dashboard/admin/criteria-stages/stages/*/edit": { label: "Edit Stage", icon: PencilIcon },
  // Questions Bank Forms
  "dashboard/questions-bank/new": { label: "Create Question", icon: PlusCircle },
  "dashboard/questions-bank/*/edit": { label: "Edit Question", icon: PencilIcon },
  // Jobs Forms
  "dashboard/jobs/new": { label: "Create Job", icon: PlusCircle },
  "dashboard/jobs/*/edit": { label: "Edit Job", icon: PencilIcon },
};

/**
 * Reconstructs a normalized path pattern from the path segments up to index.
 * Dynamic segments that are not defined in ROUTE_META are replaced with '*'.
 */
function getNormalizedPath(pathnames: string[], index: number): string {
  const segments = pathnames.slice(0, index + 1).map((seg) => {
    // If it's a known static segment fallback in ROUTE_META, keep it.
    // Otherwise, treat it as a dynamic parameter '*'.
    return ROUTE_META[seg] && !seg.includes("/") ? seg : "*";
  });
  return segments.join("/");
}

/**
 * Resolves metadata for a path segment, prioritizing path-pattern matching.
 */
function resolveMeta(pathnames: string[], index: number) {
  const segment = pathnames[index];
  const normalizedPath = getNormalizedPath(pathnames, index);
  return ROUTE_META[normalizedPath] || ROUTE_META[segment];
}

/**
 * Determines whether a path segment should be hidden from breadcrumbs.
 * @param pathnames - Array of URL path segments
 * @param index - Current segment index to evaluate
 * @returns True if segment should be hidden
 */
function shouldHideSegment(pathnames: string[], index: number) {
  const segment = pathnames[index];
  const nextSegment = pathnames[index + 1];

  // Hide and 'criteria-stages' grouping routess if we are on a child page
  if (((segment === "admin" || segment === "criteria-stages") || segment === "settings") && nextSegment) {
    return true;
  }

  // Hide any segment that doesn't have a defined label in ROUTE_META (dynamic slugs/IDs)
  // This satisfies the user's request to remove "Details" segments from the breadcrumb.
  if (!resolveMeta(pathnames, index)) {
    return true;
  }

  return false;
}

/**
 * Breadcrumb navigation component for dashboard pages.
 * Builds navigation path from current URL with route metadata labels and icons.
 * Dynamic segments (IDs/slugs) are automatically hidden.
 */
export function DashboardBreadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter(Boolean);

  const visibleSegments = pathnames
    .map((segment, index) => ({ segment, index }))
    .filter(({ index }) => !shouldHideSegment(pathnames, index));

  const crumbs = visibleSegments.map(({ index }, crumbIndex) => {
    let routeTo = `/${pathnames.slice(0, index + 1).join("/")}`;
    const segment = pathnames[index];
    if (segment === "stages" && index >= 2 && pathnames[index - 2] === "candidates" && pathnames[index + 1]) {
      routeTo += `/${pathnames[index + 1]}`;
    }
    const meta = resolveMeta(pathnames, index);
    const label = meta?.label ?? "Details";
    const Icon = meta?.icon ?? FileText;
    const isLast = crumbIndex === visibleSegments.length - 1;

    return { routeTo, label, Icon, isLast, crumbIndex };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap overflow-hidden text-[11px] text-muted-foreground sm:text-xs min-w-0">
        {crumbs.map(({ routeTo, label, Icon, isLast }) => (
          <React.Fragment key={routeTo}>
            <BreadcrumbItem
              className="flex min-w-0 items-center gap-1.5"
            >
              {isLast ? (
                <BreadcrumbPage className="flex min-w-0 items-center gap-1.5 font-semibold text-primary">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-30 sm:max-w-45 lg:max-w-60">
                    {label}
                  </span>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={<Link to={routeTo} />}
                  className="flex min-w-0 items-center gap-1.5 text-muted-foreground/70 transition-colors duration-200 hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-18 sm:max-w-35 lg:max-w-45">
                    {label}
                  </span>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {!isLast && (
              <BreadcrumbSeparator
                className="[&>svg]:size-3"
              >
                <ChevronRight className="text-muted-foreground/40" />
              </BreadcrumbSeparator>
            )}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
