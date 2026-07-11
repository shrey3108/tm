import { useState } from "react";
import { useFormContext } from "react-hook-form";
import type { JobVersionMinimal } from "@/types/job";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, History } from "lucide-react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JDPreviewModal } from "./JDPreviewModal";

export interface MoreJobSettingProps {
    versions: JobVersionMinimal[];
}

export function MoreJobSetting({ versions }: MoreJobSettingProps) {
    const { control } = useFormContext();
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleViewJD = (versionId: string) => {
        setIsDialogOpen(true);
        setSelectedVersionId(versionId);
    };

    const hasVersions = versions && versions.length > 0;

    return (
        hasVersions && (
            <Card className="border-muted/40 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <History className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight text-foreground">JD Version </h2>
                                <p className="text-xs text-muted-foreground">Select which JD version to use for candidate processing</p>
                            </div>
                        </div>

                        <FormField
                            control={control}
                            name="processing_version"
                            render={({ field }) => (
                                <FormItem className="space-y-4">
                                    <FormLabel className="sr-only">Processing Version</FormLabel>
                                    <FormControl>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {versions.map((version) => {
                                                const isSelected = field.value === version.version_num;
                                                return (
                                                    <div
                                                        key={version.id}
                                                        className={cn(
                                                            "group relative flex items-center justify-between p-1 rounded-xl border-2 transition-all duration-200 cursor-pointer flec-row",
                                                            isSelected ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" : "border-muted/60 hover:border-muted-foreground/30 hover:bg-muted/10 bg-background/50"
                                                        )}
                                                        onClick={() => field.onChange(version.version_num)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={isSelected ? "default" : "outline"} className="px-2 py-0 h-6 font-bold">
                                                                V{version.version_num}
                                                            </Badge>
                                                            {isSelected && (
                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-primary animate-in fade-in slide-in-from-left-1">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 px-2 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewJD(version.id);
                                                            }}
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                            View JD
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </CardContent>

                {/* JD Preview Modal */}
                <JDPreviewModal
                    isOpen={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    versionId={selectedVersionId}
                />
            </Card>
        )
    );
}
