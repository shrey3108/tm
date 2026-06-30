/**
 * @module AdminDashboard
 * @component AdminDashboard
 *
 * Main admin dashboard page.
 * Displays analytics summary and hiring reports for administrators.
 */

import { useState, useMemo, lazy, Suspense } from "react";
import AdminDataTable, { type Column } from "@/components/shared/AdminDataTable";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import { useAdminDashboardFilters } from "@/hooks/useAdminDashboardFilters";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3 } from "lucide-react";
import { useAdminDashboardData } from "@/hooks/queries/admin/useAdminDashboardData";
import { useJobStage } from "@/hooks/queries/admin/useJobStage";
import { useJobTitle } from "@/hooks/queries/jobs/useJob";
import AdminDashboardFilters from "@/components/admin/AdminDashboardFilters";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

const StageCentricChart = lazy(() =>
  import("@/components/admin/AdminPipelineChart").then((m) => ({ default: m.StageCentricChart }))
);
export default function AdminDashboard() {
  const [viewMode, setViewMode] = useState<"report" | "chart">("report");
  // Fetch job titles
  const { data: jobs } = useJobTitle("", true);
  // Fetch stage templates
  const { data: stagesData } = useJobStage(0, 100, "");
  const stages = useMemo(() => stagesData.map(t => ({ name: t.name })), [stagesData]);

  // Fetch dashboard summary and hiring report
  const { analytics, report, loading, error, refetch } = useAdminDashboardData();

  const { departments, stages: filteredStages, filteredReport, filteredJobs, filters, setFilter, resetFilters, toggleFilter, clearFilter, hasActiveFilters } = useAdminDashboardFilters(report, jobs, stages);

  const jobColumns: Column<any>[] = [
    { header: "Job Title", accessor: "job_title" },
    { header: "Department", accessor: "department", className: "capitalize text-center" },
    { header: "Candidate Count", accessor: "candidate_count", className: "text-center" },
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Admin Dashboard"
        breadcrumbActions={
          <div className="flex items-center justify-end gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/40">
            <Button
              variant={viewMode === "report" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("report")}
              className={cn(
                "h-8 rounded-lg px-3 transition-all duration-200",
                viewMode === "report" ? "shadow-sm bg-background text-foreground" : "text-muted-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5 mr-2" />
              Report
            </Button>
            <Button
              variant={viewMode === "chart" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("chart")}
              className={cn(
                "h-8 rounded-lg px-3 transition-all duration-200",
                viewMode === "chart" ? "shadow-sm bg-background text-foreground" : "text-muted-foreground"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-2" />
              Chart
            </Button>
          </div>
        }
      />
      {viewMode === "report" && (
        <div className="flex flex-col md:flex-row gap-6 items-stretch mb-1 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex-1 mb-2 space-y-2">
            <h2 className="text-xl font-semibold text-center">Analytics Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-6"> */}
              {/* <StatCard label="Total Users" value={analytics?.total_users ?? 0} loading={loading} /> */}
              {/* <StatCard label="Active Users" value={analytics?.active_users ?? 0} loading={loading} /> */}
              {/* <StatCard label="Total Roles" value={analytics?.total_roles ?? 0} loading={loading} /> */}
              <StatCard label="Total Jobs" value={analytics?.total_jobs ?? 0} loading={loading} />
              <StatCard label="Active Jobs" value={analytics?.active_jobs ?? 0} loading={loading} />
              <StatCard label="Total Candidates" value={analytics?.total_candidates ?? 0} loading={loading} />
              {/* <StatCard label="Total Resumes" value={analytics?.total_resumes ?? 0} loading={loading} /> */}
            </div>
          </div>
          <Separator orientation="vertical" className="hidden md:block" />
          <Separator orientation="horizontal" className="md:hidden" />
          <div className="flex-1 mb-2 space-y-2">
            <h2 className="text-xl font-semibold text-center">Hiring Report Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-6"> */}
              <StatCard label="Resumes (Last 30 Days)" value={report?.resumes_uploaded_last_30_days ?? 0} loading={loading} />
              {/* <StatCard label="Pass" value={report?.total_passed ?? 0} loading={loading}/> */}
              {/* <StatCard label="Fail" value={report?.total_failed ?? 0} loading={loading}/> */}
              {/* <StatCard label="Pending" value={report?.total_pending ?? 0} loading={loading}/> */}
              {/* <StatCard label="Unprocess" value={report?.total_unprocessed ?? 0} loading={loading} /> */}
              <StatCard label="HR Decided" value={report?.hr_decided_count ?? 0} loading={loading} />
              <StatCard label="HR Decision pending" value={report?.pending_count ?? 0} loading={loading} />
            </div>
          </div>
        </div>
      )}

      {viewMode === "chart" && (
        <div className="space-y-4 mb-6 px-1 sm:px-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <AdminDashboardFilters
            selectedDepartments={filters.departments}
            departments={departments}
            selectedJobIds={filters.jobIds}
            jobs={jobs}
            filteredJobs={filteredJobs}
            selectedStageNames={filters.stages}
            stages={filteredStages}
            setFilter={setFilter}
            resetFilters={resetFilters}
            toggleFilter={toggleFilter}
            clearFilter={clearFilter}
            hasActiveFilters={hasActiveFilters}
          />
          <Suspense fallback={<LoadingSpinner message="Loading charts..." fullPage={true} />}>
            <StageCentricChart
              data={filteredReport?.job_pipeline_stats || []}
            />
          </Suspense>
        </div>
      )}

      {viewMode === "report" && (
        <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className=" p-1 sm:p-2">
            <h3 className="mb-3">Candidates by Job</h3>
            <AdminDataTable
              columns={jobColumns}
              data={filteredReport?.candidates_by_job || []}
              loading={loading}
              error={error ? error.message : null}
              onRetry={refetch}
              rowKey="job_id"
              emptyMessage="No job data available for the selected filters."
              className="border-0 shadow-none"
            />
          </div>
        </div>
      )}
    </AppPageShell >
  );
};

