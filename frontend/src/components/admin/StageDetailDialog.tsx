import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import type { StageTemplate } from "@/types/stage";


interface StageDetailDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
    /** Stage template to display */
    template: StageTemplate | null;
}

/**
 * Dialog for viewing stage template details.
 * Shows template name and description.
 */
export const StageDetailDialog = ({
    isOpen,
    onOpenChange,
    template,
}: StageDetailDialogProps) => {
    if (!template) return null;
    // any is not good idea but its working 
    // TODO: remove any and make sure has proper types
    const config = template.config || (template as any).default_config;
    const evaluationCriteria = config?.evaluation_criteria;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-150 gap-2">
                <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-background to-background -z-10" />

                <DialogHeader className="pt-3 px-2 pb-2 sm:pt-4 sm:px-3">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-start gap-3 pr-10 sm:items-center sm:gap-4">
                            {template.name}
                        </DialogTitle>

                    </div>
                    <DialogDescription className="text-base text-muted-foreground mt-2 line-clamp-2">
                        {template.description || "N/A"}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <h3 className="text-base font-semibold text-foreground mb-3">Evaluation Criteria</h3>
                    {evaluationCriteria ? (
                        <ul className="list-disc list-outside ml-5 space-y-2">
                            {Array.isArray(evaluationCriteria) ? (
                                evaluationCriteria.map((item: any, idx: number) => {
                                    const name = typeof item === 'string' ? item : item?.name;
                                    const id = typeof item === 'string' ? idx : (item?.id || idx);
                                    return (
                                        <li key={id} className="text-base">
                                            {name}
                                        </li>
                                    );
                                })
                            ) : (
                                <li>{String(evaluationCriteria)}</li>
                            )}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No evaluation criteria defined for this stage template.</p>
                    )}
                </div>

                <DialogFooter className="p-4 border-t bg-muted/5">
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
