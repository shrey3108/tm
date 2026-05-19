import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TimelineEvent } from "@/types/candidate";
import { Calendar, Info, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateDisplay } from "../shared";

interface TimelineEventDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEvent | null;
}

export function TimelineEventDetailModal({
  isOpen,
  onOpenChange,
  event,
}: TimelineEventDetailModalProps) {
  if (!event) return null;

  const eventDate = new Date(event.event_date);
  const isStage = event.event_type === "stage";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-background to-background -z-10" />
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between mb-2 pr-10">
            <Badge
              variant={isStage ? "default" : "secondary"}
              className={cn(
                "uppercase font-black tracking-widest text-[10px] px-2 py-0.5",
                isStage ? "bg-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {event.event_type}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Calendar className="h-3 w-3" />
              <DateDisplay date={eventDate} />
            </div>
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            {event.stage_name ? `Stage: ${event.stage_name}` : "Hiring Process Update"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] p-6 pt-2">
          <div className="space-y-6">
            {/* Description Section */}
            {event.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Details
                </h4>
                <p className="text-foreground leading-relaxed">
                  {event.description}
                </p>
              </div>
            )}

            {/* Result Section */}
            {(event.result || event.score !== undefined) && (
              <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/10 flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg",
                )}>
                  {/* TODO: CHNAGE TO PASS FAIL after backend change*/}
                  {event.result?.toLowerCase().includes("pass") || event.result?.toLowerCase().includes("approve") ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : event.result?.toLowerCase().includes("fail") || event.result?.toLowerCase().includes("reject") ? (
                    <XCircle className="h-6 w-6" />
                  ) : (
                    <HelpCircle className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-black uppercase tracking-tight text-muted-foreground mb-1">Result & Score</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black capitalize">
                      {event.result || "N/A"}
                    </span>
                    {event.score !== null && event.score !== undefined && (
                      <span className="text-sm text-muted-foreground font-bold">
                        Score: {event.score}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}


          </div>
        </ScrollArea>
        <div className="p-4 bg-muted/5 border-t border-muted-foreground/10" />
      </DialogContent>
    </Dialog>
  );
}
