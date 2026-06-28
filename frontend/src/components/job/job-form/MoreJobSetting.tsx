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
// import { ALLOWED_TASK_FILE_TYPES } from "@/constants";
// import { useDownloadJobTask } from "@/hooks/queries/jobs";
// import { useDeleteJobTaskMutation } from "@/hooks/mutations/jobs/useJobTaskMutations";
// import { toast } from "sonner";
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export interface MoreJobSettingProps {
    jobId: string | null;
    versions: JobVersionMinimal[];
    taskSkills?: string[] | null;
}

export function MoreJobSetting({ versions }: MoreJobSettingProps) {
    const { control } = useFormContext();
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // const fileInputRef = useRef<HTMLInputElement>(null);
    // const { data: jobTaskBlob } = useDownloadJobTask(jobId);
    // const { mutate: deleteJobTaskMutation } = useDeleteJobTaskMutation();

    const handleViewJD = (versionId: string) => {
        setIsDialogOpen(true);
        setSelectedVersionId(versionId);
    };

    // const handleViewJobTask = () => {
    //     if (!jobTaskBlob) return;
    //     const url = URL.createObjectURL(jobTaskBlob);
    //     window.open(url, "_blank");
    // };

    // const handleDeleteJobTask = () => {
    //     if (!jobId) return;
    //     deleteJobTaskMutation(jobId, {
    //         onSuccess: () => {
    //             setValue("project_document", undefined);
    //             if (fileInputRef.current) {
    //                 fileInputRef.current.value = "";
    //             }
    //             toast.success("Project requirement documentation deleted successfully.");
    //         },
    //         onError: (error) => {
    //             console.error("Failed to delete task document:", error);
    //             toast.error("Failed to delete project requirement documentation.");
    //         }
    //     });
    // };

    // const handleClearFile = (e: React.MouseEvent, onChange: (...event: any[]) => void) => {
    //     e.stopPropagation();
    //     onChange(undefined);
    //     if (fileInputRef.current) {
    //         fileInputRef.current.value = "";
    //     }
    // };

    const hasVersions = versions && versions.length > 0;

    return (
        hasVersions && <Card className="border-muted/40 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6 space-y-6">
                {hasVersions && (
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

                        <FormField control={control} name="processing_version" render={({ field }) => (
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

                                                    <div className="flex items-center gap-2"><Badge variant={isSelected ? "default" : "outline"} className="px-2 py-0 h-6 font-bold">V{version.version_num}</Badge>
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
                )}

                {/* {hasVersions && <div className="border-t border-muted/20 my-2"></div>} */}

                {/* Project Requirement Documentation Section */}
                {/* <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight text-foreground">Project Requirement Documentation</h2>
                            <p className="text-xs text-muted-foreground">Upload guidelines or requirement details for the candidates ({ALLOWED_TASK_FILE_TYPES.join(" ")}, max 5MB)</p>
                        </div>
                    </div>

                    <FormField
                        control={control}
                        name="project_document"
                        render={({ field }) => {
                            const selectedFile = field.value as File | string | undefined;

                            const getFileName = (file: File | string) => {
                                if (typeof file === "string") {
                                    const cleanPath = file.split("?")[0];
                                    return cleanPath.split(/[/\\]/).pop() || "";
                                }
                                return file.name;
                            };

                            return (
                                <FormItem className="space-y-4">
                                    <FormLabel className="sr-only">Project Requirement Documentation</FormLabel>
                                    <FormControl>
                                        <div
                                            onClick={() => {
                                                if (!selectedFile) {
                                                    fileInputRef.current?.click();
                                                }
                                            }}
                                            className={cn(
                                                "border-2 border-dashed border-muted-foreground/25 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-muted/5 transition-colors relative",
                                                !selectedFile
                                                    ? "hover:border-primary/50 dark:hover:border-primary/40 cursor-pointer hover:bg-muted/10"
                                                    : "cursor-default"
                                            )}
                                        >
                                            <input
                                                type="file"
                                                accept={ALLOWED_TASK_FILE_TYPES.join(",")}
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        field.onChange(file);
                                                    }
                                                }}
                                                ref={fileInputRef}
                                            />

                                            {selectedFile ? (
                                                <div className="flex items-center gap-3 w-full bg-background border border-muted-foreground/15 rounded-xl p-3 animate-in fade-in zoom-in-95">
                                                    <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate font-sans">
                                                            {getFileName(selectedFile)}
                                                        </p>
                                                    </div>
                                                    {typeof selectedFile === "string" ? (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="rounded-lg gap-1.5 text-xs"
                                                                onClick={handleViewJobTask}
                                                                disabled={!jobTaskBlob}
                                                            >
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                View
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="rounded-lg gap-1.5 text-xs"
                                                                onClick={handleDeleteJobTask}
                                                            >
                                                                <Trash className="h-3.5 w-3.5" />
                                                                Delete
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg gap-1.5 text-xs"
                                                            onClick={(e) => handleClearFile(e, field.onChange)}
                                                        >
                                                            <Trash className="h-3.5 w-3.5" />
                                                            Clear
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <Upload className="h-5 w-5" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-medium">Click to upload</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {ALLOWED_TASK_FILE_TYPES.join(", ")} files only (Max 5MB)
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            );
                        }}
                    />

                    {taskSkills && taskSkills.length > 0 && (
                        <Accordion className="w-full" >
                            <AccordionItem value="task-skills" >
                                <AccordionTrigger className={"hover:no-underline px-2 py-2"}>Extracted Skills from Task Document</AccordionTrigger>
                                <AccordionContent>
                                    <div className="flex flex-wrap gap-1.5">
                                        {taskSkills.map((skill, index) => (
                                            <Badge
                                                key={index}
                                                variant="secondary"
                                                className="px-2.5 py-0.5 text-xs font-medium bg-secondary/60 text-secondary-foreground"
                                            >
                                                {skill}
                                            </Badge>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    )}
                </div> */}
            </CardContent>

            {/* JD Preview Modal */}
            <JDPreviewModal
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                versionId={selectedVersionId}
            />
        </Card >
    );
}
