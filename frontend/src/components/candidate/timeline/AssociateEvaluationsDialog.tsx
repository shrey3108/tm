import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateDisplay } from "@/components/shared/DateDisplay";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";
import type { AssociateResultsResponse, AssociateReviewResult } from "@/types/associateReview";
import { resolveAssociateViewUrl } from "@/lib/utils";
import { Link } from 'react-router-dom';
import { NativeScrollArea } from "@/components/ui/native-scroll-area";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { MessageCircle, ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";

interface AssociateEvaluationsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  associateResults?: AssociateResultsResponse;
}

export function AssociateEvaluationsDialog({
  isOpen,
  onOpenChange,
  associateResults,
}: AssociateEvaluationsDialogProps) {
  const showDbdColumns = associateResults?.reviews?.some(
    (r) => r.dbd_hiring_decision !== null || r.dbd_remarks !== null
  );

  const columns: ColumnDef<AssociateReviewResult>[] = [
    {
      accessorKey: "associate_name",
      size: showDbdColumns ? 20 : 25,
      meta: { overflow: "ellipsis" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Name
          <ArrowUpDown className="h-4 w-4 ml-1" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.associate_name}
        </span>
      ),
    },
    {
      accessorKey: "sent_at",
      size: showDbdColumns ? 15 : 20,
      meta: { overflow: "ellipsis" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Sent At
          <ArrowUpDown className="h-4 w-4 ml-1" />
        </Button>
      ),
      cell: ({ row }) => (
        <DateDisplay date={row.original.sent_at} showTime={true} />
      ),
    },
    {
      accessorKey: "submitted_at",
      size: showDbdColumns ? 15 : 20,
      meta: { overflow: "ellipsis" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Submitted At
          <ArrowUpDown className="h-4 w-4 ml-1" />
        </Button>
      ),
      cell: ({ row }) =>
        row.original.submitted_at ? (
          <DateDisplay date={row.original.submitted_at} showTime={true} />
        ) : (
          <span className="text-sm text-muted-foreground italic">Pending</span>
        ),
    },
    {
      id: "status_result",
      size: showDbdColumns ? 15 : 20,
      meta: { overflow: "ellipsis" },
      header: () => (
        <div className="flex items-center justify-center gap-2">
          <span className="text-base">Status / Result</span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center items-center">
          <CandidateStatusBadge status={row.original.result || row.original.status} />
        </div>
      ),
    },
    {
      id: "marks",
      size: 15,
      meta: { overflow: "ellipsis" },
      header: () => (
        <div className="flex items-center justify-center gap-2 w-full">
          <span className="text-base">Marks</span>
        </div>
      ),
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex flex-col items-center justify-center gap-1">
            {(() => {
              if (r.weighted_result_out_of_5 !== null && r.weighted_result_out_of_5 !== undefined) {
                return (
                  <span className="font-semibold text-sm">
                    {r.weighted_result_out_of_5.toFixed(1)}/5
                  </span>
                );
              }
              if (r.dbd_scores && r.dbd_scores.length > 0) {
                const validScores = r.dbd_scores
                  .map((s) => s.score)
                  .filter((score): score is number => score !== null && score !== undefined);
                if (validScores.length > 0) {
                  const avg = validScores.reduce((sum, val) => sum + val, 0) / validScores.length;
                  return (
                    <span className="font-semibold text-sm">
                      {avg.toFixed(1)}/5
                    </span>
                  );
                }
              }
              return <span className="text-muted-foreground">-</span>;
            })()}
            {r.review_token && r.submitted_at && (
              <Link
                to={resolveAssociateViewUrl(r.review_token!)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                View Marks
              </Link>
            )}
          </div>
        );
      },
    },
    ...(showDbdColumns
      ? [
        {
          id: "dbd_decision",
          size: 20,
          meta: { overflow: "ellipsis" },
          header: () => (
            <div className="flex items-center gap-2">
              <span className="text-base">DBD Decision</span>
            </div>
          ),
          cell: ({ row }: { row: { original: AssociateReviewResult } }) => {
            const r = row.original;
            return (
              <div className="flex items-center gap-1.5">
                {r.dbd_hiring_decision ? (
                  <CandidateStatusBadge status={r.dbd_hiring_decision} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                {r.dbd_remarks && (
                  <HoverCard>
                    <HoverCardTrigger delay={100} closeDelay={50}>
                      <MessageCircle className="h-4 w-4 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer ml-1" />
                    </HoverCardTrigger>
                    <HoverCardContent className="w-fit max-w-70 px-3 py-1.5 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-md" side="top">
                      <p className="whitespace-pre-wrap">{r.dbd_remarks}</p>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>
            );
          },
        },
      ]
      : []),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-4xl p-4 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-0 mb-4">
          <DialogTitle className="text-sm font-bold text-gray-900 dark:text-white">
            Associate Evaluations Status
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of all associates review status, timestamps, and marks.
          </DialogDescription>
        </DialogHeader>

        <NativeScrollArea className="flex-1 min-h-0 w-full">
          {associateResults && associateResults.reviews && (
            <div className="w-full">
              <DataTable
                columns={columns}
                data={associateResults.reviews}
                showPagination={false}
                minWidth="min-w-full"
                emptyMessage="No associate reviews found."
              />
            </div>
          )}
        </NativeScrollArea>
      </DialogContent>
    </Dialog>
  );
}
