/**
 * @module AdminStats
 * @component AdminStats
 *
 * Dashboard view displaying overall admin statistics, charts, and metrics.
 */
import { useAdminDashboardData } from "@/hooks/queries/admin/useAdminDashboardData";
// import AppPageHeader from "@/components/shared/AppPageHeader";
import AppPageShell from "@/components/shared/AppPageShell";
import StatCard from "@/components/shared/StatCard";
import { DataTable } from "@/components/shared/DataTable";
import {
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import PageHeader from "@/components/shared/PageHeader";
export default function AdminStats() {
  const { analytics, report, loading, error, refetch: fetchData, } = useAdminDashboardData();

  const llmParsedCount = report
    ? report.total_passed + report.total_failed + report.total_pending
    : 0;
  const passRate =
    report && report.total_passed + report.total_failed > 0
      ? (report.total_passed / (report.total_passed + report.total_failed)) * 100
      : 0;

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "job_title",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Job Title
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue("job_title")}</span>,
    },
    {
      accessorKey: "candidate_count",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-center w-full text-base"
        >
          Candidates
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center font-bold">{row.getValue("candidate_count")}</div>
      ),
    },
  ];

  return (
    <AppPageShell width="wide">
      <PageHeader
        title="Platform Statistics"
      />

      {loading && !analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border rounded-3xl bg-destructive/5">
          <p className="text-destructive font-medium">{error instanceof Error ? error.message : String(error)}</p>
          <Button onClick={() => fetchData()} variant="outline" className="rounded-xl">
            Retry Loading Stats
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8">
            <StatCard
              label="Total Users"
              value={analytics?.total_users ?? 0}

              className="bg-primary/5 border border-primary/10"
            />
            <StatCard
              label="Active Users"
              value={analytics?.active_users ?? 0}

              className="bg-green-500/5 border border-green-500/10"
            />
            <StatCard
              label="Total Jobs"
              value={analytics?.total_jobs ?? 0}

              className="bg-blue-500/5 border border-blue-500/10"
            />
            <StatCard
              label="Active Jobs"
              value={analytics?.active_jobs ?? 0}

              className="bg-indigo-500/5 border border-indigo-500/10"
            />
            <StatCard
              label="Total Candidates"
              value={analytics?.total_candidates ?? 0}

              className="bg-orange-500/5 border border-orange-500/10"
            />
            <StatCard
              label="Total Resumes"
              value={analytics?.total_resumes ?? 0}

              className="bg-purple-500/5 border border-purple-500/10"
            />
            <StatCard
              label="Resumes (Last 30d)"
              value={report?.resumes_uploaded_last_30_days ?? 0}

              className="bg-pink-500/5 border border-pink-500/10"
            />
            <StatCard
              label="Pass Rate"
              value={`${passRate.toFixed(1)}%`}

              className="bg-yellow-500/5 border border-yellow-500/10"
            />
            <StatCard
              label="LLM Parsed"
              value={llmParsedCount}
              className="bg-emerald-500/5 border border-emerald-500/10"
            />
            <StatCard
              label="HR Decided"
              value={report?.hr_decided_count ?? 0}
              className="bg-cyan-500/5 border border-cyan-500/10"
            />
            <StatCard
              label="No Action"
              value={report?.pending_count ?? 0}
              className="bg-amber-500/5 border border-amber-500/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Candidates by Job</h2>
              </div>
              <div className="app-surface-card overflow-hidden p-0">
                <DataTable
                  columns={columns}
                  data={report?.candidates_by_job || []}
                  searchKey="job_title"
                  searchPlaceholder="Search jobs..."
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold tracking-tight">Performance Summary</h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="border rounded-2xl p-5 bg-linear-to-br from-primary/10 to-transparent border-primary/20 space-y-1.5">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Average Resume Score
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-primary">
                      {report?.average_resume_score
                        ? report.average_resume_score.toFixed(1)
                        : "0.0"}
                    </span>
                    <span className="text-lg font-semibold text-primary/60">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Overall average match score calculated across all analyzed resumes.
                  </p>
                </div>

                <div className="border rounded-2xl p-5 bg-card/50 border-border/50 space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Active Job Ratio</span>
                      <span className="font-bold">
                        {analytics?.total_jobs
                          ? Math.round((analytics.active_jobs / analytics.total_jobs) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${analytics?.total_jobs ? (analytics.active_jobs / analytics.total_jobs) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Active User Ratio</span>
                      <span className="font-bold">
                        {analytics?.total_users
                          ? Math.round((analytics.active_users / analytics.total_users) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${analytics?.total_users ? (analytics.active_users / analytics.total_users) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )
      }
    </AppPageShell>
  );
}
