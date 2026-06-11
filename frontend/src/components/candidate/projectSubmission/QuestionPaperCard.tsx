import { toast } from "sonner";
import { HelpCircle, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useDownloadPaperTaskFile, } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import type { QuestionSetPaperRead } from "@/types/taskPaper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


interface QuestionPaperCardProps {
    paper: QuestionSetPaperRead;
    onDelete: (paperId: string) => void;
    isDeleting: boolean;
}

export function QuestionPaperCard({ paper, onDelete, isDeleting }: QuestionPaperCardProps) {
    const { refetch: downloadFile, loading: isDownloading } = useDownloadPaperTaskFile(
        paper.task_file_path ? paper.id : null,
        { enabled: false }
    );

    const handleView = async () => {
        if (!paper.task_file_path) return;
        try {
            const { data: blob } = await downloadFile();
            if (blob) {
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
            } else {
                toast.error("Failed to download the task file.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to download the task file.");
        }
    };

    return (
        <Card className="flex flex-col border border-border/30 hover:border-primary/20 bg-card/30 hover:bg-card/50 transition-all duration-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md group p-1 gap-1">
            <CardHeader className="border-b border-border/20 bg-muted/10 px-1 py-0.5 flex flex-row items-center justify-between [.border-b]:pb-1">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform duration-300 shrink-0">
                        <HelpCircle className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base font-bold tracking-tight text-foreground truncate">
                        {paper.name}
                    </CardTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {paper.task_file_path && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleView}
                            disabled={isDownloading}
                            className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                            title="View Task File"
                        >
                            {isDownloading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                                <ExternalLink className="h-4 w-4" />
                            )}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(paper.id)}
                        disabled={isDeleting}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                        title="Delete Question Set Paper"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-2 flex-1 space-y-1">
                {/* Questions */}
                <div className="space-y-1">
                    <h4 className="text-base font-semibold text-muted-foreground ">
                        Questions
                    </h4>
                    {paper.questions && paper.questions.length > 0 ? (
                        <ul className="list-decimal pl-5">
                            {paper.questions.map((q, idx) => (
                                <li key={idx}>
                                    <p className="text-sm font-medium text-foreground leading-relaxed wrap-break-words">
                                        {q}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground italic pl-1">
                            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                            Extracting questions and skills...
                        </div>
                    )}
                </div>

                {/* Project Task */}
                {paper.project_task && (
                    <div className="space-y-1">
                        <h4 className="text-base font-semibold text-muted-foreground ">
                            Project Task
                        </h4>
                        <div className="px-1.5 py-0.5 rounded-xl border border-border/20 bg-background/50 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            {paper.project_task}
                        </div>
                    </div>
                )}

                {/* Extracted Skills */}
                {paper.task_skills && paper.task_skills.length > 0 && (
                    <div className="space-y-1">
                        <h4 className="text-base font-semibold text-muted-foreground ">
                            Extracted Skills
                        </h4>
                        <div className="flex flex-wrap gap-1.5 pl-1">
                            {paper.task_skills.map((skill, sIdx) => (
                                <Badge key={sIdx} variant="outline">
                                    {skill}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


