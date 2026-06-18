import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { useJobTitlesGrouped } from "@/hooks/queries/jobs";
import { useQuestionSetPapers } from "@/hooks/queries/taskPapers/useTaskPaperQueries";
import {
  useUploadQuestionSetPaperMutation,
  useDeleteQuestionSetPaperMutation,
} from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, SearchableSelect } from "@/components/shared";
import { Label } from "@/components";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS, hasPermissions } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { useDebouncedValue } from "@/hooks";
import { QuestionsBankAccordion } from "@/components/candidate/projectSubmission/QuestionsBankAccordion";
import { ManualPaperCreateForm } from "@/components/candidate/projectSubmission/sendQuestionPaper/ManualPaperCreateForm";
import { extractErrorMessage } from "@/utils/error";

export default function QuestionsBank() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAppSelector(selectCurrentUser);
  const hasManagePermission = hasPermissions(currentUser?.permissions, PERMISSIONS.QUESTIONS_MANAGE);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false)
  // const [selectedJobId, setSelectedJobId] = useState<string>("");
  // const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<{ job_id: string; position_id: string; position_name: string } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [jobSearch, setJobSearch] = useState<string>("");
  const [positionSearch, setPositionSearch] = useState<string>("");

  // Debounce search queries for backend API calls
  const debouncedJobSearch = useDebouncedValue(jobSearch);
  const debouncedPositionSearch = useDebouncedValue(positionSearch);

  // Fetch jobs list
  // const { data: jobs, loading: loadingJobs } = useJobTitle(debouncedJobSearch, true);

  // Fetch job positions
  // const { data: positions, loading: loadingPositions } = useJobPosition(0, 10, debouncedPositionSearch);

  const { data: groupedTitles, loading: loadingJobs } = useJobTitlesGrouped(debouncedJobSearch, true);
  const uniqueTitles = groupedTitles.map(g => g.title);
  const selectedGroup = groupedTitles.find(g => g.title === selectedTitle);
  const availablePositions = selectedGroup?.variants ?? [];
  useEffect(() => {
    let timeout: number;
    if (groupedTitles.length > 0 && !selectedTitle) {
      timeout = setTimeout(() => {
        const firstTitle = groupedTitles[0].title;
        setSelectedTitle(firstTitle);
        if (groupedTitles[0].variants.length > 0) {
          setSelectedVariant(groupedTitles[0].variants[0]);
        }
      }, 0);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [groupedTitles, selectedTitle]);


  // Detect async loading
  const isJobSearching = jobSearch !== debouncedJobSearch;
  const isPositionSearching = positionSearch !== debouncedPositionSearch;

  // Stable callbacks for onSearch
  const handleJobSearch = useCallback((query: string) => setJobSearch(query), []);
  const handlePositionSearch = useCallback((query: string) => setPositionSearch(query), []);

  // Compute active selections
  // const activeJobId = selectedJobId || jobs?.[0]?.id || "";
  // const activePositionId = selectedPositionId || positions[0]?.id || "";
  const activeJobId = selectedVariant?.job_id || "";
  const activePositionId = selectedVariant?.position_id || "";

  // Fetch predefined Question Set Papers with polling if any paper is still extracting questions
  // do polling if `questions: []` means empty array
  const {
    data: questionPapers = [],
    loading: loadingPapers,
    refetch: refetchPapers,
  } = useQuestionSetPapers({
    jobId: activeJobId || undefined,
    positionId: activePositionId || undefined,
    options: {
      refetchInterval: (query: unknown) => {
        // @ts-expect-error
        const papers = (query as { state?: { data?: { questions?: string[] }[] }[] })?.state?.data;
        const hasProcessing = Array.isArray(papers) && papers.some(
          (paper) => !paper.questions || paper.questions.length === 0
        );
        return hasProcessing ? 15000 : false;
      }
    }
  });

  // Mutations for templates/papers
  const uploadMutation = useUploadQuestionSetPaperMutation();
  const deleteMutation = useDeleteQuestionSetPaperMutation();

  const allSkills = Array.from(
    new Set((questionPapers || []).flatMap((paper) => paper.task_skills || []))
  );

  // File Upload Handlers
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
        } catch (err: unknown) {
          toast.error(extractErrorMessage(err, `Failed to upload '${file.name}'.`));
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

  // @ts-expect-error will use again after discussion
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeletePaper = (paperId: string) => {
    deleteMutation.mutate(paperId, {
      onSuccess: () => {
        toast.success("Successfully deleted the question set paper.");
        refetchPapers();
      },
      onError: (err: unknown) => {
        toast.error(extractErrorMessage(err, "Failed to delete question set paper."));
      },
    });
  };

  const handleJobChange = (title: string) => {
    setSelectedTitle(title);
    const newGroup = groupedTitles.find(g => g.title === title);
    if (newGroup && newGroup.variants.length > 0) {
      setSelectedVariant(newGroup.variants[0]);
    } else {
      setSelectedVariant(null);
    }
    setShowCreateForm(false);
  };

  const handlePositionChange = (positionId: string) => {
    setSelectedVariant(availablePositions.find(pos => pos.position_id == positionId) || null);
    setShowCreateForm(false);
  };



  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500 bg-background min-h-screen">
      <AppPageHeader title="Questions Bank" />

      <div className="space-y-2">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row gap-2 flex-1 p-2">
            {/* Job Selector */}
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>Select Job Role</Label>
              <SearchableSelect
                value={selectedTitle}
                onValueChange={handleJobChange}
                // options={jobs?.map((job) => ({ id: job.id, label: job.title })) || []}
                options={uniqueTitles?.map((title) => ({ id: title, label: title })) || []}
                placeholder="Choose a job role..."
                searchPlaceholder="Search jobs..."
                disabled={!uniqueTitles || uniqueTitles.length === 0}
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
              <Label>Select Experience / Position Level</Label>
              <SearchableSelect
                value={activePositionId}
                onValueChange={handlePositionChange}
                options={availablePositions?.map((pos) => ({ id: pos.position_id, label: pos.position_name })) || []}
                placeholder={selectedTitle ? "Choose a position level..." : "Select a job role first"}
                disabled={!selectedTitle || availablePositions.length === 0}
                searchPlaceholder="Search levels..."
                loading={loadingJobs}
                loadingPlaceholder="Loading levels..."
                emptyMessage="No position levels found"
                moreText="position levels"
                onSearch={handlePositionSearch}
                asyncLoading={isPositionSearching}
              />
            </div>
          </div>

          {/* Action Upload Widget */}
          <div className="flex items-end shrink-0 md:self-end p-2">
            <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
              <Button
                onClick={handleUploadClick}
                disabled={!activeJobId || !activePositionId || isUploading}
                variant="outline"
                className="rounded-xl border border-muted-foreground/10 px-5 font-semibold text-center h-11"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Upload new set"}
              </Button>
            </PermissionGuard>
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

        {/* Loading papers state */}
        {loadingPapers ? (
          <LoadingSpinner message="Loading question set papers..." />
        ) : questionPapers.length === 0 ? (
          <div className="animate-in fade-in duration-300">
            {!showCreateForm ?
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <div className="text-center py-4 border border-dashed border-border/60 rounded-2xl bg-card/10 text-muted-foreground">
                  <p className="font-semibold text-foreground/80">No Question Set Papers Found</p>
                  <p className="text-sm mt-1 max-w-md mx-auto">
                    There are no predefined question set papers for the selected job and experience level.
                    Upload a document to automatically extract questions, or define one manually below!
                  </p>
                </div>
                <Button onClick={() => setShowCreateForm(true)}>Add</Button>
              </div> : (
                hasManagePermission && <ManualPaperCreateForm
                  jobId={activeJobId}
                  positionId={activePositionId}
                  onSuccess={() => refetchPapers()}
                />
              )}
          </div>
        ) : (
          <div className="space-y-2 animate-in fade-in duration-300">

            {/* Questions Bank Accordion */}
            <QuestionsBankAccordion
              questionPapers={questionPapers}
              refetchPapers={refetchPapers}
            />
            {/* Extracted Skills Section */}

            {allSkills.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card/10 p-2 space-y-1">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Extracted Skills
                </h3>
                <div className="flex flex-wrap gap-1.5 px-1 pb-0.5">
                  {allSkills.map((skill, sIdx) => (
                    <Badge key={sIdx} variant="outline" className="bg-background/50 text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

        )}
      </div>
    </AppPageShell>
  );
}
