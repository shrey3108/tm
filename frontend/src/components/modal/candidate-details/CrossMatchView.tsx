import { useState } from "react";
import { Search, ExternalLink, RefreshCw, Compass, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CrossJobMatchRead } from "@/types/crossMatch";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";
import { capitalize } from "@/lib/utils";
import { extractErrorMessage } from "@/utils/error";
import { DEFAULT_PASSING_THRESHOLD } from "@/constants";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { useCandidateCrossJobMatch } from "@/hooks/queries/candidates/useCandidateCrossJobMatch";
import { useTriggerCrossMatchMutation } from "@/hooks/mutations/candidates/useCandidateCrossJobMatchMutation";
interface CrossMatchViewProps {
  resumeId?: string;
  candidateId?: string;
  onClose?: () => void;
}

/**
 * CrossMatchView Component
 * 
 * Displays and manages the "Cross-Job Match" feature.
 * Allows triggering a background matching process and polls for results.
 */
export function CrossMatchView({ resumeId, onClose }: CrossMatchViewProps) {
  const [isPolling, setIsPolling] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">("all");

  const navigate = useNavigate();

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const triggerCrossMatchMutation = useTriggerCrossMatchMutation();

  const { data: matches, total, loading } = useCandidateCrossJobMatch(
    resumeId!,
    pageIndex * pageSize,
    pageSize,
    isPolling ? 15000 : false
  );

  const handleTrigger = async () => {
    if (!resumeId) return;
    setIsPolling(true);
    try {
      await triggerCrossMatchMutation.mutateAsync(resumeId);
      toast.info("Cross Job Match triggered. Scanning all active jobs...");
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to trigger Cross Job Match.");
      setIsPolling(false);
    }
  };

  const handleGoToJob = (jobTitle: string, jobId: string) => {
    if (onClose) onClose();
    navigate(`/dashboard/jobs/${slugify(jobTitle)}/candidates`, { state: { jobId } });
  };

  const filteredMatches = matches.filter((match) => {
    if (statusFilter === "all") return true;
    const isPassed = match.match_score >= (match.matched_job?.passing_threshold ?? DEFAULT_PASSING_THRESHOLD);
    return statusFilter === "pass" ? isPassed : !isPassed;
  });

  // Note: With  client-side filtering only applies to the current page

  const columns: ColumnDef<CrossJobMatchRead>[] = [
    {
      header: "Job",
      accessorKey: "job_title",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <span className="font-medium text-foreground">
            {row.original.matched_job?.title || "Unknown Job"}
          </span>
          <Badge variant="outline" className="bg-muted text-[10px] font-medium px-1.5 py-0">
            {row.original.matched_job?.department_name || "N/A"}
          </Badge>
        </div>
      ),
    },
    {
      header: ({ column }) => <>
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold"
        >
          Match Score
          <ArrowUpDown className="h-4 w-4" />
        </Button></>,
      accessorKey: "match_score",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 min-w-[140px]">
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full"
              style={{ width: `${row.original.match_score}%` }}
            />
          </div>
          <span className="font-black text-blue-600 tracking-tight text-xs">
            {row.original.match_score}%
          </span>
        </div>
      )
    },
    {
      accessorKey: "status",
      header: ({ column }) => <>
        <Button
          variant="ghost"
          className="hover:bg-transparent p-0 font-semibold"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </>,
      cell: ({ row }) => {
        const match = row.original;
        const threshold = match.matched_job?.passing_threshold ?? DEFAULT_PASSING_THRESHOLD;
        const passed = match.match_score >= threshold;

        return (
          <Badge
            variant={passed ? "default" : "destructive"}
            className={`rounded-full px-2.5 py-0.5 flex items-center gap-1.5 w-fit border-0 shadow-none text-black ${passed
              ? "bg-green-300 dark:bg-green-300"
              : "bg-red-300 dark:bg-red-300"
              }`}
          >
            {passed ? "PASS" : "FAIL"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "actions",
      header: "View Job",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleGoToJob(row.original.matched_job?.title || "", row.original.matched_job_id)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )
    }
  ];

  if (!resumeId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/10 rounded-2xl border border-dashed border-muted-foreground/20">
        <div className="p-4 bg-muted/20 rounded-full mb-4">
          <Search className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="text-muted-foreground font-medium">No resume found for this candidate.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Cross Job Match requires a parsed resume.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2">
        <div className="space-y-0.5">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            Cross Job Match
          </h3>
          <p className="text-sm text-muted-foreground leading-tight">
            Identify matches for this candidate across other open active positions.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:mr-1">
          {matches.length > 0 && <Select
            value={statusFilter}
            onValueChange={(value) => value && setStatusFilter(value)}
            modal={false}
          >
            <SelectTrigger className="w-27.5 h-10 rounded-xl" size="sm">
              <SelectValue placeholder="Filter">
                {capitalize(statusFilter)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="" align="end" alignItemWithTrigger={false}>
              <SelectItem value="all">Results</SelectItem>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Fail</SelectItem>
            </SelectContent>
          </Select>}

          <Button
            onClick={handleTrigger}
            className="rounded-xl h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md active:scale-95 whitespace-nowrap"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {matches.length > 0 ? "Re-Cross Job Match" : "Cross Job Match"}
          </Button>
        </div>
      </div>


      {matches.length > 0 || loading ? (
        <div className="w-full">
          <DataTable
            columns={columns}
            data={filteredMatches}
            loading={loading}
            emptyMessage={`No matches found for the "${statusFilter}" filter.`}
            isServerSide={true}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageCount={Math.ceil(total / pageSize)}
            onPaginationChange={setPagination}
            totalRecords={total}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/5 rounded-2xl border border-dashed border-border">
          <Compass className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <h4 className="font-bold text-foreground">No matches found yet</h4>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Click "Cross Job Match" to scan this candidate against all active jobs.
          </p>
        </div>
      )}
    </div>
  );
}
