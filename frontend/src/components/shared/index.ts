/**
 * Common UI components barrel export.
 * Re-exports DateDisplay, Button, Input, and Card components with their variants.
 */

export { DateDisplay, default as DateDisplayDefault } from "@/components/shared/DateDisplay";
export { default as DeleteModal } from "@/components/modal/DeleteModal";
export { default as LoadingSpinner } from "@/components/shared/LoadingSpinner";
export { default as ErrorDisplay } from "@/components/shared/ErrorDisplay";
export { default as AppPageHeader } from "@/components/shared/AppPageHeader";
export { default as AppPageShell } from "@/components/shared/AppPageShell";
export { default as PageHeader } from "@/components/shared/PageHeader";
export { default as StatusBadge } from "@/components/shared/StatusBadge";
export { default as CandidateStatusBadge } from "@/components/shared/CandidateStatusBadge";
export { default as ErrorBoundary } from "@/components/shared/ErrorBoundary";
export { default as AdminDataTable, type Column } from "@/components/shared/AdminDataTable";
export { default as Pagination } from "@/components/shared/Pagination";
export { default as SkillsBadgeList } from "@/components/shared/SkillsBadgeList";
export { default as StatCard } from "@/components/shared/StatCard";
export { default as JobSummaryCard } from "@/components/shared/JobSummaryCard";
export { default as CandidateSearchForm } from "@/components/shared/CandidateSearchForm";
export { Logo } from "@/components/logo";
export { Skeleton } from "@/components/ui/skeleton";
export {
  TextSkeleton,
  TableRowSkeleton,
  CardSkeleton,
} from "@/components/shared/SkeletonVariants";
export { DataTable } from "@/components/shared/DataTable";
export { ToastProvider, useToast } from "@/components/shared/ToastProvider";
export { CandidatesDistributionChart } from "@/components/shared/BarChart";
export { default as InfoLabel } from "@/components/shared/InfoLabel";
