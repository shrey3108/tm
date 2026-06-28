import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useJobVersion } from "@/hooks/queries/jobs/useJob";

export interface JDPreviewModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    versionId: string | null;
}

/**
 * 
 * Component for JD Preview Modal
 * 
 * 
 */
export function JDPreviewModal({ isOpen, onOpenChange, versionId }: JDPreviewModalProps) {
    const { data: previewVersion, loading: isPreviewLoading } = useJobVersion(versionId, isOpen)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
                <DialogHeader className="p-2 pb-2 border-b border-muted-foreground/10 bg-muted/30">
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                        <Badge variant="outline" className="h-7 px-2.5 font-bold text-sm bg-background">
                            V{previewVersion?.version_number ?? ""}
                        </Badge>
                        JD Preview
                    </DialogTitle>
                </DialogHeader>

                <div className="relative min-h-[300px] flex-1 overflow-hidden">
                    {isPreviewLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/50 backdrop-blur-[2px] z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium text-muted-foreground">Loading JD content...</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full w-full">
                            <div className="p-4">
                                {previewVersion?.jd_text ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed font-sans">
                                            {previewVersion.jd_text}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground italic bg-muted/5 rounded-xl border border-dashed border-muted">
                                        No JD text available for this version.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
