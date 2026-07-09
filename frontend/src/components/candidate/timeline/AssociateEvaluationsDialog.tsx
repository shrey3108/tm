import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { DateDisplay } from "@/components/shared/DateDisplay";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";
import type { AssociateResultsResponse } from "@/types/associateReview";
import { resolveAssociateViewUrl } from "@/lib/utils";
import { Link } from 'react-router-dom';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-0 mb-4">
          <DialogTitle className="text-sm font-bold text-gray-900 dark:text-white">
            Associate Evaluations Status
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of all associates review status, timestamps, and marks.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 w-full">
          {associateResults && associateResults.reviews && (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-900/50 w-full min-w-150">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100 dark:bg-zinc-900 text-xs font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                    <TableHead className="p-2 h-auto">Name</TableHead>
                    <TableHead className="p-2 h-auto">Sent At</TableHead>
                    <TableHead className="p-2 h-auto">Submitted At</TableHead>
                    <TableHead className="p-2 h-auto">Status / Result</TableHead>
                    <TableHead className="p-2 h-auto text-right ">Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {associateResults.reviews.map((r) => (
                    <TableRow key={r.id} className="border-b border-gray-200 dark:border-gray-800">
                      <TableCell className="p-2 text-gray-900 dark:text-white">
                        <div>{r.associate_name}</div>
                        {/* <div className="text-xs  font-normal">{r.associate_email}</div> */}
                      </TableCell>
                      <TableCell className="p-2 ">
                        <DateDisplay date={r.sent_at} showTime={true} className="text-xs" />
                      </TableCell>
                      <TableCell className="p-2 ">
                        {r.submitted_at ? (
                          <DateDisplay date={r.submitted_at} showTime={true} className="text-xs" />
                        ) : (
                          <span className="text-xs">Pending</span>
                        )}
                      </TableCell>
                      <TableCell className="p-2">
                        <CandidateStatusBadge status={r.result || r.status} />
                      </TableCell>
                      <TableCell className="p-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {r.weighted_result_out_of_5 !== null && r.weighted_result_out_of_5 !== undefined ? (
                            <span className="font-bold text-gray-900 dark:text-white">{r.weighted_result_out_of_5.toFixed(1)}/5</span>
                          ) : (
                            <span className="">-</span>
                          )}
                          {r.review_token && r.submitted_at && <Link
                            to={resolveAssociateViewUrl(r.review_token!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-900 dark:text-white underline font-semibold cursor-pointer"
                          >
                            View Marks
                          </Link>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
