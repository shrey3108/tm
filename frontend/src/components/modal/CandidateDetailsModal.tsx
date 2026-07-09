import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
// import { Separator } from "@/components/ui/separator";
import type { CandidateResponse } from "@/types/resume";
import type { CandidateAnalysis } from "@/types/admin";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import type { JobVersionDetail, JobVersionMinimal } from "@/types/job";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  candidateDecisionSchema,
  type CandidateDecisionFormValues,
} from "@/schemas/candidate";
import { useJob, useJobVersion } from "@/hooks/queries/jobs/useJob";
import { useHrDecisionHistoryQuery } from "@/hooks/queries/candidates";
import { useSubmitDecisionMutation } from "@/hooks/mutations/candidates/useCandidateStages";

// Sub-components
import { CandidateHeader } from "@/components/modal/candidate-details/CandidateHeader";
// import { AnalysisStats } from "@/components/modal/candidate-details/AnalysisStats";
import {
  // AnalysisTabs,
  type AnalysisTab
} from "@/components/modal/candidate-details/AnalysisTabs";
import { AnalysisContent } from "@/components/modal/candidate-details/AnalysisContent";
import { DecisionHistory } from "@/components/modal/candidate-details/DecisionHistory";
import { JobDescriptionView } from "@/components/modal/candidate-details/JobDescriptionView";
import { HrDecision } from "@/components/modal/candidate-details/HrDecision";
import { FeedbackDialog } from "@/components/modal/candidate-details/FeedbackDialog";
import { ActionButtons } from "@/components/modal/candidate-details/ActionButtons";
import { CrossMatchView } from "@/components/modal/candidate-details/CrossMatchView";
import { VersionResultView } from "@/components/modal/candidate-details/VersionResultView";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { extractErrorMessage } from "@/utils/error";

/**
 * Props for {@link CandidateDetailsModal}.
 */
interface CandidateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateResponse | CandidateAnalysis | null;
  jobId?: string;
  onDecisionSubmitted?: () => void | Promise<void>;
  initialTab?: AnalysisTab;
  passing_threshold?: number;
}

/**
 * Modal dialog that displays a full candidate profile including resume analysis,
 * missing skills, extraordinary points, and the job description version used for screening.
 *
 * Allows HR users to 'pass', 'fail', or mark a candidate as "maybe" by submitting
 * a screening decision with an optional note. The modal fetches the associated job
 * and its version data on open, and refreshes the screening decision after submission.
 */
export function CandidateDetailsModal({
  isOpen,
  onClose,
  candidate,
  jobId,
  onDecisionSubmitted,
  initialTab = "analysis",
  passing_threshold,
}: CandidateDetailsModalProps) {
  // console.log(candidate);
  const submitDecisionMutation = useSubmitDecisionMutation();
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>(initialTab);

  const form = useForm<CandidateDecisionFormValues>({
    resolver: zodResolver(candidateDecisionSchema),
    defaultValues: {
      note: "",
      score: 0,
    },
  });

  const { reset } = form;

  // Sync activeTab with initialTab and reset selectedVersionId when modal opens/changes candidate
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "analysis");
      setSelectedVersionId(null);
    }
  }, [isOpen, initialTab, candidate?.id]);

  const currentJobId = jobId || (candidate as { applied_job_id?: string | null })?.applied_job_id;

  // 1. Fetch job details using TanStack query hook
  const { data: job, loading: isLoadingJob } = useJob(
    isOpen && currentJobId ? currentJobId : null
  );

  // 2. Fetch specific job version if version meta is found, using TanStack query hook
  const appliedVersion = (candidate as { applied_version_number?: number | null })?.applied_version_number;
  const versionMeta = isOpen && job && appliedVersion && job.job_versions
    ? job.job_versions.find((v: JobVersionMinimal) => v.version_num === appliedVersion)
    : null;
  const activeVersionId = selectedVersionId || versionMeta?.id || null;

  const { data: fetchedVersionData, loading: isLoadingVersion } = useJobVersion(
    activeVersionId,
    !!activeVersionId
  );

  // Compute active version data with fallback logic
  const selectedVersionData = useMemo<JobVersionDetail | null>(() => {
    if (!isOpen || !job) return null;

    if (activeVersionId) {
      return fetchedVersionData;
    }

    const versionCount = job.total_versions ?? job.job_versions?.length ?? 0;
    if (versionCount <= 1) {
      return {
        id: job.job_versions?.[0]?.id ?? job.id,
        job_id: job.id,
        version_number: job.job_versions?.[0]?.version_num ?? job.version ?? 1,
        title: job.title,
        jd_text: job.jd_text,
        jd_json: job.jd_json,
        custom_extraction_fields: job.custom_extraction_fields ?? null,
        created_at: job.created_at,
      };
    }

    return null;
  }, [isOpen, job, activeVersionId, fetchedVersionData]);

  // 3. Fetch HR Decision History using TanStack query hook
  const { data: decisionHistoryData, isLoading: isLoadingHistory } = useHrDecisionHistoryQuery(
    isOpen && candidate?.id ? candidate.id : null,
    currentJobId,
    undefined
  );

  const decisionHistory = useMemo(() => {
    return decisionHistoryData?.decisions ?? [];
  }, [decisionHistoryData]);

  const hrDecision = useMemo(() => {
    return decisionHistory.length > 0 ? decisionHistory[0] : null;
  }, [decisionHistory]);

  if (!candidate) return null;

  const canTakeDecision =
    !hrDecision || hrDecision.decision.toLowerCase() === "may be";

  const handleAction = (type: CandidateDecisionFormValues['decision']) => {
    reset({
      decision: type,
      note: form.watch("note") || "",
      score: form.watch("score") || 0,
    })
    form.clearErrors();
    setShowFeedbackModal(true);
  };

  const submitFeedback = async (data: CandidateDecisionFormValues) => {
    if (!candidate?.id) return;

    try {
      await submitDecisionMutation.mutateAsync({
        candidate_id: candidate.id,
        decision: data.decision,
        note: data.note || undefined,
        score: data.score,
        job_id: currentJobId || undefined,
      });

      await onDecisionSubmitted?.();
      toast.success("Decision submitted successfully");
      setShowFeedbackModal(false);
      form.reset({ note: "", score: 0 });
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage || "Failed to submit decision");
    }
  };

  const handleVersionChange = (val: string | null) => {
    if (!val) return;
    setSelectedVersionId(val);
  };

  const filterHrDecision = decisionHistory.filter(
    (d) => d.stage_config_id == null
  )
  const finalHrDecision = filterHrDecision.length > 0 ? filterHrDecision[0] : hrDecision

  return (
    <Dialog open={isOpen} onOpenChange={onClose} >
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col sm:w-[92vw] sm:max-w-[92vw] lg:max-w-250 max-h-[calc(100vh-1rem)] sm:max-h-[92vh] p-0 overflow-hidden rounded-[1.75rem] sm:rounded-3xl border-muted-foreground/10 bg-card/95 backdrop-blur-xl shadow-2xl h-[650px] gap-1 custom-scrollbar">
        <DialogHeader className="p-2">
          <CandidateHeader candidate={candidate} activeTab={activeTab} passing_threshold={passing_threshold ?? 0} setActiveTab={setActiveTab} />
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar">
          {activeTab === "analysis" ? (
            <AnalysisContent
              candidate={candidate}
              showAllSkills={showAllSkills}
              setShowAllSkills={setShowAllSkills}
              jobId={currentJobId}
            >
              {finalHrDecision && finalHrDecision.decision.toLowerCase() !== "may be" && (
                <HrDecision decision={finalHrDecision} />
              )}
              <DecisionHistory decisions={filterHrDecision} />
            </AnalysisContent>
          ) : activeTab === "jd" ? (
            <JobDescriptionView
              job={job}
              selectedVersionData={selectedVersionData}
              isLoadingVersion={isLoadingVersion}
              onVersionChange={handleVersionChange}
              appliedVersionNumber={
                (candidate as CandidateAnalysis)?.applied_version_number ??
                undefined
              }
            />
          ) : activeTab === "cross-job-match" ? (
            <CrossMatchView
              resumeId={(candidate as CandidateAnalysis)?.resume_id}
              candidateId={candidate.id}
              onClose={onClose}
            />
          ) : (
            <VersionResultView
              candidate={candidate as CandidateAnalysis}
              job={job}
              showAllSkills={showAllSkills}
              setShowAllSkills={setShowAllSkills}
            />
          )}
        </div>

        {!isLoadingHistory && !isLoadingJob && canTakeDecision && (
          <PermissionGuard permissions={PERMISSIONS.CANDIDATES_DECIDE} hideWhenDenied>
            <ActionButtons
              onAction={handleAction}
              showMaybeButton={
                !hrDecision || hrDecision.decision.toLowerCase() !== "may be"
              }
            />
          </PermissionGuard>
        )}
      </DialogContent>

      <FeedbackDialog
        isOpen={showFeedbackModal}
        onOpenChange={setShowFeedbackModal}
        form={form}
        onSubmit={submitFeedback}
        candidateName={candidate.first_name || "candidate"}
        isSubmitting={submitDecisionMutation.isPending}
      />
    </Dialog>
  );
}
