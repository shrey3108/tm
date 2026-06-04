import { useState, useRef } from "react";
import { useFormContext } from "react-hook-form";
import type { JobVersionMinimal } from "@/types/job";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, History, FileText, Upload, X } from "lucide-react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JDPreviewModal } from "./JDPreviewModal";
import { ALLOWED_TASK_FILE_TYPES } from "@/constants";

export interface MoreJobSettingProps {
    jobId: string | null;
    versions: JobVersionMinimal[];
    taskSkills?: string[] | null;
}

export function MoreJobSetting({ versions, taskSkills }: MoreJobSettingProps) {
    const { control } = useFormContext();
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleViewJD = (versionId: string) => {
        setIsDialogOpen(true);
        setSelectedVersionId(versionId);
    };

    const handleClearFile = (e: React.MouseEvent, onChange: (...event: any[]) => void) => {
        e.stopPropagation();
        onChange(undefined);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const hasVersions = versions && versions.length > 0;

    return (
        <Card className="border-muted/40 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
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
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-2 text-xs font-semibold border border-muted rounded-xl hover:text-primary transition-colors"
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

                {hasVersions && <div className="border-t border-muted/20 my-6"></div>}

                {/* Project Requirement Documentation Section */}
                <div className="space-y-6">
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
                                                        <p className="text-xs text-muted-foreground">
                                                            {typeof selectedFile === "string" ? "Already Uploaded" : `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground animate-in fade-in"
                                                        onClick={(e) => handleClearFile(e, field.onChange)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
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
                        <div className="space-y-2 mt-4 animate-in fade-in duration-300">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Extracted Skills from Task Document
                            </h3>
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
                        </div>
                    )}
                </div>
            </CardContent>

            {/* JD Preview Modal */}
            <JDPreviewModal
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                versionId={selectedVersionId}
            />
        </Card>
    );
}
