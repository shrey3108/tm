import { useState } from "react";
import { toast } from "sonner";
import { HelpCircle, Trash2, Loader2, ExternalLink, Edit2, Plus } from "lucide-react";
import { useDownloadPaperTaskFile } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import type { QuestionSetPaperRead } from "@/types/taskPaper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/permissions";
import PermissionGuard from "@/components/auth/PermissionGuard";
import {
    useAddQuestionToPaperMutation,
    useUpdateQuestionInPaperMutation,
    useDeleteQuestionFromPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { QuestionModal, DeleteModal } from "@/components/modal";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"

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

    const addMutation = useAddQuestionToPaperMutation();
    const updateMutation = useUpdateQuestionInPaperMutation();
    const deleteQuestionMutation = useDeleteQuestionFromPaperMutation();

    // Modal state for Add/Edit question
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [questionModalMode, setQuestionModalMode] = useState<"add" | "edit">("add");
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
    const [selectedQuestionText, setSelectedQuestionText] = useState("");

    // Modal state for Delete question confirmation
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [questionIndexToDelete, setQuestionIndexToDelete] = useState<number | null>(null);

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

    const handleOpenAddModal = () => {
        setQuestionModalMode("add");
        setSelectedQuestionIndex(null);
        setSelectedQuestionText("");
        setIsQuestionModalOpen(true);
    };

    const handleOpenEditModal = (index: number, text: string) => {
        setQuestionModalMode("edit");
        setSelectedQuestionIndex(index);
        setSelectedQuestionText(text);
        setIsQuestionModalOpen(true);
    };

    const handleSaveQuestion = async (text: string) => {
        if (questionModalMode === "add") {
            await addMutation.mutateAsync(
                { paperId: paper.id, question: text },
                {
                    onSuccess: () => {
                        toast.success("Question added successfully!");
                    },
                    onError: (error: any) => {
                        toast.error(error?.response?.data?.detail || "Failed to add question.");
                    },
                }
            );
        } else if (questionModalMode === "edit" && selectedQuestionIndex !== null) {
            await updateMutation.mutateAsync(
                { paperId: paper.id, index: selectedQuestionIndex, question: text },
                {
                    onSuccess: () => {
                        toast.success("Question updated successfully!");
                    },
                    onError: (error: any) => {
                        toast.error(error?.response?.data?.detail || "Failed to update question.");
                    },
                }
            );
        }
    };

    const handleOpenDeleteConfirm = (index: number) => {
        setQuestionIndexToDelete(index);
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (questionIndexToDelete === null) return;
        await deleteQuestionMutation.mutateAsync(
            { paperId: paper.id, index: questionIndexToDelete },
            {
                onSuccess: () => {
                    toast.success("Question deleted successfully!");
                    setIsDeleteConfirmOpen(false);
                    setQuestionIndexToDelete(null);
                },
                onError: (error: any) => {
                    toast.error(error?.response?.data?.detail || "Failed to delete question.");
                },
            }
        );
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
                        <HoverCard>
                            <HoverCardTrigger delay={10} closeDelay={10}><Button
                                variant="ghost"
                                size="icon"
                                onClick={handleView}
                                disabled={isDownloading}
                                className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"

                            >
                                {isDownloading ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                    <ExternalLink className="h-4 w-4" />
                                )}
                            </Button></HoverCardTrigger>
                            <HoverCardContent className="w-full p-0.5 text-xs rounded-lg">
                                Github Submmited link
                            </HoverCardContent>
                        </HoverCard>

                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(paper.id)}
                        disabled={isDeleting}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"

                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-2 flex-1 space-y-3">
                {/* Questions */}
                <div className="space-y-1.5">
                    <h4 className="text-base font-semibold text-muted-foreground">
                        Questions
                    </h4>
                    {paper.questions && paper.questions.length > 0 ? (
                        <ul className="pl-6 list-decimal space-y-0.5">
                            {paper.questions.map((q, idx) => (
                                <li
                                    key={idx}
                                    className="group/item relative pl-1 pr-20 hover:bg-muted/30 rounded-lg transition-colors duration-200"
                                >
                                    <p className="text-sm font-medium text-foreground leading-relaxed wrap-break-words">
                                        {q}
                                    </p>
                                    <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenEditModal(idx, q)}
                                                className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenDeleteConfirm(idx)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </PermissionGuard>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground italic pl-1 py-1">
                            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                            Extracting questions and skills...
                        </div>
                    )}

                    <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                        <div className="pt-1.5 pl-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenAddModal}
                                className="h-8 text-xs font-semibold border-dashed border-primary/20 hover:border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-all"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add Question
                            </Button>
                        </div>
                    </PermissionGuard>
                </div>

                {/* Project Task */}
                {paper.project_task && (
                    <div className="space-y-1">
                        <h4 className="text-base font-semibold text-muted-foreground">
                            Project Task
                        </h4>
                        <div className="px-3 py-2 rounded-xl border border-border/20 bg-background/50 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            {paper.project_task}
                        </div>
                    </div>
                )}

                {/* Extracted Skills */}
                {paper.task_skills && paper.task_skills.length > 0 && (
                    <div className="space-y-1.5">
                        <h4 className="text-base font-semibold text-muted-foreground">
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

            {/* Modals */}
            <QuestionModal
                show={isQuestionModalOpen}
                handleClose={() => setIsQuestionModalOpen(false)}
                onSave={handleSaveQuestion}
                initialValue={selectedQuestionText}
                isSaving={addMutation.isPending || updateMutation.isPending}
            />

            <DeleteModal
                show={isDeleteConfirmOpen}
                handleClose={() => setIsDeleteConfirmOpen(false)}
                handleConfirm={handleConfirmDelete}
                title="Delete Question"
                message="Are you sure you want to delete this question? This action cannot be undone."
                isLoading={deleteQuestionMutation.isPending}
            />
        </Card>
    );
}
