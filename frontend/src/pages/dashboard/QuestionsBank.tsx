import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Upload, HelpCircle } from "lucide-react";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { useJobTitle } from "@/hooks/queries/jobs";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { useQuestionSetPapers, } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import { useUploadQuestionSetPaperMutation, useDeleteQuestionSetPaperMutation } from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, SearchableSelect } from "@/components/shared";
import { Label } from "@/components";
import { QuestionPaperCard } from "@/components/candidate/projectSubmission/QuestionPaperCard";
import { useDebouncedValue } from "@/hooks";

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
  const [jobSearch, setJobSearch] = useState<string>("");
  const [positionSearch, setPositionSearch] = useState<string>("");

  // Debounce search queries for backend API calls
  const debouncedJobSearch = useDebouncedValue(jobSearch);
  const debouncedPositionSearch = useDebouncedValue(positionSearch);

  // Fetch jobs list 
  const { data: jobs, loading: loadingJobs } = useJobTitle(debouncedJobSearch, true);

  // Fetch job positions
  const { data: positions, loading: loadingPositions } = useJobPosition(0, 10, debouncedPositionSearch);

  // Detect async loading: search text has changed but debounced value hasn't caught up yet
  const isJobSearching = jobSearch !== debouncedJobSearch;
  const isPositionSearching = positionSearch !== debouncedPositionSearch;

  // Stable callbacks for onSearch
  const handleJobSearch = useCallback((query: string) => setJobSearch(query), []);
  const handlePositionSearch = useCallback((query: string) => setPositionSearch(query), []);

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

  };

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500 bg-background min-h-screen">
      <AppPageHeader title="Questions Bank" />

      <div className="space-y-3">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2  rounded-xl border border-border/40 bg-card/40 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            {/* Job Selector */}
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>
                Select Job Role
              </Label>
              <SearchableSelect
                value={activeJobId}
                onValueChange={(val) => setSelectedJobId(val)}
                options={jobs?.map((job) => ({ id: job.id, label: job.title })) || []}
                placeholder="Choose a job role..."
                searchPlaceholder="Search jobs..."
                disabled={!jobs || jobs.length === 0}
                loading={loadingJobs}
                loadingPlaceholder="Loading jobs..."
                emptyMessage="No active jobs found"
                moreText="jobs"
                onSearch={handleJobSearch}
                asyncLoading={isJobSearching}
              />
            </div>

            {/* Position Level Selector */}
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>
                Select Experience / Position Level
              </Label >
              <SearchableSelect
                value={activePositionId}
                onValueChange={(val) => setSelectedPositionId(val)}
                options={positions?.map((pos) => ({ id: pos.id, label: pos.name })) || []}
                placeholder="Choose a position level..."
                searchPlaceholder="Search levels..."
                disabled={!positions || positions.length === 0}
                loading={loadingPositions}
                loadingPlaceholder="Loading levels..."
                emptyMessage="No position levels found"
                moreText="position levels"
                onSearch={handlePositionSearch}
                asyncLoading={isPositionSearching}
              />
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
              <QuestionPaperCard
                key={paper.id}
                paper={paper}
                onDelete={handleDeletePaper}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
