import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { CriterionRead } from "@/types/jobCriteria";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { FileText } from "lucide-react";

interface CriteriaInfoModalProps {
  criterion: CriterionRead | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal to display detailed information about an evaluation criterion.
 */
export const CriteriaInfoModal = ({ criterion, isOpen, onClose }: CriteriaInfoModalProps) => {
  if (!criterion) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between gap-20">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {criterion.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground line-clamp-2  mt-1">
                {criterion.description || "No description provided."}
              </DialogDescription>
              <p>Created At:
                {" "}
                <span className="font-semibold">
                  <DateDisplay date={criterion.created_at} />
                </span>
              </p>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 pb-6 overflow-y-auto">

          <Separator className="bg-border/40" />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <FileText className="h-4 w-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider">AI Evaluation Rubric</h3>
            </div>
            <div className="p-6 rounded-2xl bg-primary/3 border border-primary/10 shadow-inner">
              <div className="prose prose-sm prose-slate dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground/80 font-medium">
                {criterion.prompt_text?.trim() || "No AI rubric defined for this criterion."}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
