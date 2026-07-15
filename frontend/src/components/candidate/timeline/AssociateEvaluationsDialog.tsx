import { Fragment } from "react";
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
import { NativeScrollArea } from "@/components/ui/native-scroll-area";

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

        <NativeScrollArea className="flex-1 min-h-0 w-full">
          {associateResults && associateResults.reviews && (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-900/50 w-full min-w-150">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100 dark:bg-zinc-900 text-xs font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                    <TableHead className="p-2 h-auto">Name</TableHead>
                    <TableHead className="p-2 h-auto">Sent At</TableHead>
                    <TableHead className="p-2 h-auto">Submitted At</TableHead>
                    <TableHead className="p-2 h-auto">Status / Result</TableHead>
                    <TableHead className="p-2 h-auto text-right">Marks</TableHead>
                    {/* <TableHead className="p-2 h-auto">DBD Decision</TableHead>   */}
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {associateResults.reviews.map((r) => (
                    <Fragment key={r.id}>
                      <TableRow className="border-b border-gray-200 dark:border-gray-800">
                        <TableCell className="p-2 text-gray-900 dark:text-white">
                          <div>{r.associate_name}</div>
                          {/* <div className="text-xs  font-normal">{r.associate_email}</div> */}
                        </TableCell>
                        <TableCell className="p-2">
                          <DateDisplay date={r.sent_at} showTime={true} className="text-xs" />
                        </TableCell>
                        <TableCell className="p-2">
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
                            {(() => {
                              if (r.weighted_result_out_of_5 !== null && r.weighted_result_out_of_5 !== undefined) {
                                return (
                                  <span className="font-bold text-gray-900 dark:text-white">
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
                                    <span className="font-bold text-gray-900 dark:text-white">
                                      {avg.toFixed(1)}/5
                                    </span>
                                  );
                                }
                              }
                              return <span className="">-</span>;
                            })()}
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
                        {/* <TableCell className="p-2">
                          {r.dbd_hiring_decision ? (
                            <CandidateStatusBadge status={r.dbd_hiring_decision} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell> */}
                      </TableRow>
                      {/* {(r.dbd_scores || r.dbd_remarks) && (
                        <TableRow className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-zinc-900/30">
                          <TableCell colSpan={6} className="p-2 text-xs">
                            <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-primary/30">
                              {r.dbd_scores && r.dbd_scores.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider mr-1">DBD Scores:</span>
                                  {r.dbd_scores.map((score, i) => (
                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                      {score.name}: {score.score}/5
                                    </span>
                                  ))}
                                </div>
                              )}
                              {r.dbd_remarks && (
                                <div className="flex items-start gap-1">
                                  <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider mr-1 shrink-0">Remarks:</span>
                                  <p className="text-foreground/80 italic">"{r.dbd_remarks}"</p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )} */}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </NativeScrollArea>
      </DialogContent>
    </Dialog>
  );
}
