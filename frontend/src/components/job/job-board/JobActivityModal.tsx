import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import type { Job } from "@/types/job";
import { Users, Clock, Calendar } from "lucide-react";

interface JobActivityModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  onSessionClick?: (startDate: string, endDate?: string) => void;
}

export function JobActivityModal({ isOpen, onOpenChange, job, onSessionClick }: JobActivityModalProps) {
  if (!job) return null;

  const sessions = job.activity_sessions || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[60vw] max-w-[60vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-150">
        <div className="p-6 pb-2 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-primary" />
              <DialogTitle className="text-xl">Activity Sessions</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Detailed activation history for <span className="font-semibold text-foreground">{job.title}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="app-surface-card p-3 flex flex-col items-center justify-center text-center  border-primary/10">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Candidates</span>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{job.total_candidates || 0}</span>
              </div>
            </div>
            <div className="app-surface-card p-3 flex flex-col items-center justify-center text-center  border-blue-500/10">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Sessions</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{sessions.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 px-6 pb-6 overflow-y-auto">
          <Table className="border-separate border-spacing-0">
            <TableHeader className="sticky top-0 bg-background z-20 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20 bg-background border-b">ID</TableHead>
                <TableHead className="bg-background border-b">Period</TableHead>
                <TableHead className="text-right bg-background border-b">Total</TableHead>
                <TableHead className="text-center bg-background border-b">Approve</TableHead>
                <TableHead className="text-center bg-background border-b">Reject</TableHead>
                <TableHead className="text-center bg-background border-b">Pending</TableHead>
                <TableHead className="w-30 text-center bg-background border-b">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">
                    No activity sessions found for this job.
                  </TableCell>
                </TableRow>
              ) : (
                [...sessions].reverse().map((session) => (
                  <TableRow
                    key={session.session_id}
                    className={cn(
                      "transition-colors",
                      session.is_current ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50",
                      onSessionClick && "cursor-pointer"
                    )}
                    onClick={() => onSessionClick?.(session.start_date, session.end_date as string)}
                  >
                    <TableCell className="font-medium">#{session.session_id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground w-10">Start:</span>
                          <DateDisplay date={session.start_date} showTime />
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground w-10">End:</span>
                          {session.end_date ? (
                            <DateDisplay date={session.end_date} showTime />
                          ) : (
                            <span className="text-primary font-medium">Ongoing</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-mono text-sm px-2">
                        {session.candidate_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono text-sm px-2">
                        {session.approved_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono text-sm px-2">
                        {session.rejected_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono text-sm px-2">
                        {session.pending_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {session.is_current ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 pointer-events-none">
                          Current
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="opacity-60 pointer-events-none">
                          Closed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
