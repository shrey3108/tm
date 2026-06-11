import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, HelpCircle, Trash2, Loader2 } from "lucide-react";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { useJobTitle } from "@/hooks/queries/jobs";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { useQuestionSetPapers } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useUploadQuestionSetPaperMutation,
  useDeleteQuestionSetPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared";
import { Badge } from "@/components/ui/badge";

interface ApiErrorResponse {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

export default function QuestionsBank() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Fetch jobs list
  const { data: jobs, loading: loadingJobs } = useJobTitle("", true);

  // Fetch job positions 
  const { data: positions, loading: loadingPositions } = useJobPosition(0, 100);

  // Compute active selections (default to first item if state is empty)
  const activeJobId = selectedJobId || jobs?.[0]?.id || "";
  const activePositionId = selectedPositionId || positions?.[0]?.id || "";

  // Fetch predefined Question Set Papers with polling if any paper is still extracting questions
  // do polling if `questions: []` means empty array
  const {
    data: questionPapers,
    loading: loadingPapers,
    refetch: refetchPapers,
  } = useQuestionSetPapers({
    jobId: activeJobId || undefined,
    positionId: activePositionId || undefined,
    options: {
      refetchInterval: (query: unknown) => {
        const papers = (query as { state?: { data?: { questions?: string[] }[] } })?.state?.data;
        const hasProcessing = Array.isArray(papers) && papers.some(
          (paper) => !paper.questions || paper.questions.length === 0
        );
        return hasProcessing ? 3000 : false;
      }
    }
  });

  // Mutations
  const uploadMutation = useUploadQuestionSetPaperMutation();
  const deleteMutation = useDeleteQuestionSetPaperMutation();

  const selectedJob = jobs?.find((j) => j.id === activeJobId);
  const selectedPosition = positions?.find((p) => p.id === activePositionId);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (!activeJobId || !activePositionId) {
        toast.error("Please select both a job and a position level first.");
        return;
      }

      setIsUploading(true);
      const fileList = Array.from(files);

      const uploadPromises = fileList.map(async (file) => {
        try {
          await uploadMutation.mutateAsync({
            jobId: activeJobId,
            positionId: activePositionId,
            file,
          });
          toast.success(`Successfully uploaded and triggered AI extraction for '${file.name}'!`);
        } catch (err) {
          const error = err as ApiErrorResponse;
          toast.error(
            error.response?.data?.detail || 
            `Failed to upload '${file.name}'.`
          );
        }
      });

      await Promise.all(uploadPromises);

      refetchPapers();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsUploading(false);
    }
  };

  const handleDeletePaper = (paperId: string) => {
    if (confirm("Are you sure you want to delete this question set paper template?")) {
      deleteMutation.mutate(paperId, {
        onSuccess: () => {
          toast.success("Successfully deleted the question set paper.");
          refetchPapers();
        },
        onError: (err) => {
          const error = err as ApiErrorResponse;
          toast.error(error.response?.data?.detail || "Failed to delete question set paper.");
        },
      });
    }
  };

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500 bg-background min-h-screen">
      <AppPageHeader title="Questions Bank" />

      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Job Selector */}
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-semibold text-muted-foreground ">
                Select Job Role
              </label>
              <Select
                value={activeJobId}
                onValueChange={(val) => setSelectedJobId(val ?? "")}
                disabled={loadingJobs || !jobs || jobs.length === 0}
              >
                <SelectTrigger className="w-full h-11 bg-input/20 border-border/50 hover:bg-input/30 transition-all text-sm rounded-xl">
                  <SelectValue placeholder={loadingJobs ? "Loading jobs..." : "Choose a job role..."}>
                    {selectedJob ? selectedJob.title : "Choose a job role..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id} className="cursor-pointer wrap-break-word">
                      {job.title}
                    </SelectItem>
                  ))}
                  {(!loadingJobs && (!jobs || jobs.length === 0)) && (
                    <SelectItem value="none" disabled>
                      No active jobs found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Position Level Selector */}
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-semibold text-muted-foreground ">
                Select Experience / Position Level
              </label>
              <Select
                value={activePositionId}
                onValueChange={(val) => setSelectedPositionId(val ?? "")}
                disabled={loadingPositions || !positions || positions.length === 0}
              >
                <SelectTrigger className="w-full h-11 bg-input/20 border-border/50 hover:bg-input/30 transition-all text-sm rounded-xl">
                  <SelectValue placeholder={loadingPositions ? "Loading levels..." : "Choose a position level..."}>
                    {selectedPosition ? selectedPosition.name : "Choose a position level..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {positions?.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id} className="cursor-pointer wrap-break-word">
                      {pos.name}
                    </SelectItem>
                  ))}
                  {(!loadingPositions && (!positions || positions.length === 0)) && (
                    <SelectItem value="none" disabled>
                      No position levels found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Upload Widget */}
          <div className="flex items-end shrink-0 md:self-end">
            <Button
              onClick={handleUploadClick}
              disabled={!activeJobId || !activePositionId || isUploading}
              variant="outline"
              className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-9"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload new set"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx"
              multiple
              className="hidden"
            />
          </div>
        </div>

        {/* Question Sets Layout */}
        {loadingPapers ? (
          <LoadingSpinner message="Loading question set papers..." />
        ) : questionPapers.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/60 rounded-2xl bg-card/10 text-muted-foreground">
            <HelpCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/60" />
            <p className="font-semibold text-foreground/80">No Question Set Papers Found</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              There are no predefined question set papers for the selected job and experience level.
              Upload a document above to automatically extract questions and projects using AI!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionPapers.map((paper) => (
              <Card
                key={paper.id}
                className="flex flex-col border border-border/30 hover:border-primary/20 bg-card/30 hover:bg-card/50 transition-all duration-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md group p-2 gap-2"
              >
                <CardHeader className="border-b border-border/20 bg-muted/10 px-2 py-1.5 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform duration-300 shrink-0">
                      <HelpCircle className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base font-bold tracking-tight text-foreground truncate">
                      {paper.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeletePaper(paper.id)}
                    disabled={deleteMutation.isPending}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="p-2 flex-1 space-y-1">
                  {/* Questions */}
                  <div className="space-y-1.5">
                    <h4 className="text-base font-semibold text-muted-foreground ">
                      Questions
                    </h4>
                    {paper.questions && paper.questions.length > 0 ? (
                      <ul >
                        {paper.questions.map((q, idx) => (
                          <li
                            key={idx}
                            className="flex items-start justify-between gap-1.5 "
                          >
                            <div className="flex gap-3 min-w-0">
                              <span className="text-xs font-black text-muted-foreground/60 select-none bg-muted/40 h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <p className="text-sm font-medium text-foreground leading-relaxed wrap-break-words">
                                {q}
                              </p>
                            </div>
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
                          <Badge key={sIdx} variant="outline">{skill}</Badge>

                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}

