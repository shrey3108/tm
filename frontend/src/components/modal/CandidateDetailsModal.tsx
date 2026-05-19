import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
// import { Separator } from "@/components/ui/separator";
import type { CandidateResponse } from "@/types/resume";
import type { CandidateAnalysis } from "@/types/admin";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { candidateDecisionApi } from "@/apis/candidateDecision";
import type {
  HrDecisionHistoryItem,
  CandidateDecision,
} from "@/apis/candidateDecision";
import { adminJobService } from "@/apis/admin/job";
import type { Job, JobVersionDetail } from "@/types/job";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  candidateDecisionSchema,
  type CandidateDecisionFormValues,
} from "@/schemas/candidate";

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
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [hrDecision, setHrDecision] =
    useState<CandidateDecision | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<
    HrDecisionHistoryItem[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [selectedVersionData, setSelectedVersionData] =
    useState<JobVersionDetail | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>(initialTab);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);

  const form = useForm<CandidateDecisionFormValues>({
    resolver: zodResolver(candidateDecisionSchema),
    defaultValues: {
      note: "",
      score: 5,
    },
  });

  const { reset } = form;

  // Sync activeTab with initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "analysis");
    }
  }, [isOpen, initialTab]);

  const currentJobId = jobId || (candidate as any)?.applied_job_id;

  useEffect(() => {
    if (isOpen && currentJobId) {
      setIsLoadingJob(true);
      adminJobService.getJobById(currentJobId).then((data) => {
        setJob(data as unknown as Job);
      }).finally(() => {
        setIsLoadingJob(false);
      });
    } else {
      setJob(null);
      setIsLoadingJob(false);
    }
  }, [isOpen, jobId, (candidate as any)?.applied_job_id, currentJobId]);

  useEffect(() => {
    const appliedVersion = (candidate as any)?.applied_version_number;
    if (!isOpen || !job) {
      setIsLoadingVersion(false);
      setSelectedVersionData(null);
      return;
    }

    // If candidate has an applied version, fetch it.
    if (appliedVersion && job.job_versions) {
      const versionMeta = job.job_versions.find(
        (v) => v.version_num === appliedVersion,
      );
      if (versionMeta) {
        setIsLoadingVersion(true);
        adminJobService
          .getJobVersion(versionMeta.id)
          .then((data) => setSelectedVersionData(data))
          .finally(() => setIsLoadingVersion(false));
        return;
      }
    }

    // If the job has no saved snapshots yet, or only a single version,
    // fall back to the JD content already included on the job payload
    // instead of showing an empty state.
    const versionCount = job.total_versions ?? job.job_versions?.length ?? 0;
    if (versionCount <= 1) {
      setSelectedVersionData({
        id: job.job_versions?.[0]?.id ?? job.id,
        job_id: job.id,
        version_number: job.job_versions?.[0]?.version_num ?? job.version ?? 1,
        title: job.title,
        jd_text: job.jd_text,
        jd_json: job.jd_json,
        custom_extraction_fields: job.custom_extraction_fields ?? null,
        created_at: job.created_at,
      });
      return;
    }

    setSelectedVersionData(null);
  }, [isOpen, job, (candidate as any)?.applied_version_number]);

  useEffect(() => {
    if (isOpen && candidate?.id) {
      setIsLoadingHistory(true);
      candidateDecisionApi
        .getDecisionHistory(candidate.id, jobId)
        .then((data) => {
          setDecisionHistory(data.decisions);
          // The first item in history is the latest decision
          setHrDecision(
            data.decisions.length > 0 ? data.decisions[0] : null,
          );
        })
        .catch(() => {
          setHrDecision(null);
          setDecisionHistory([]);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      setHrDecision(null);
      setDecisionHistory([]);
    }
  }, [isOpen, candidate?.id]);

  if (!candidate) return null;

  const canTakeDecision =
    !hrDecision || hrDecision.decision.toLowerCase() === "may be";

  const handleAction = (type: CandidateDecisionFormValues['decision']) => {
    reset({
      decision: type,
      note: form.watch("note") || "",
      score: form.watch("score") || 5,
    })
    form.clearErrors();
    setShowFeedbackModal(true);
  };

  const submitFeedback = async (data: CandidateDecisionFormValues) => {
    if (!candidate?.id) return;

    setIsSubmitting(true);
    try {
      const result = await candidateDecisionApi.submitDecision({
        candidate_id: candidate.id,
        decision: data.decision,
        note: data.note,
        score: data.score,
      });
      setHrDecision(result);
      // Refresh history to include the new decision
      const historyResponse = await candidateDecisionApi.getDecisionHistory(
        candidate.id, jobId
      );
      setDecisionHistory(historyResponse.decisions);
      await onDecisionSubmitted?.();
      toast.success("Decision submitted successfully");
      setShowFeedbackModal(false);
      form.reset({ note: "", score: 5 })
    } catch (error) {
      const errorMessage = extractErrorMessage(error)
      toast.error(errorMessage || "Failed to submit decision");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVersionChange = (val: string | null) => {
    if (!val) return;
    setIsLoadingVersion(true);
    adminJobService
      .getJobVersion(val)
      .then((data) => setSelectedVersionData(data))
      .finally(() => setIsLoadingVersion(false));
  };

  const filterHrDecision = decisionHistory.filter(
    (d) => d.stage_config_id == null
  )
  const finalHrDecision = filterHrDecision.length > 0 ? filterHrDecision[0] : hrDecision

  return (
    <Dialog open={isOpen} onOpenChange={onClose} >
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col sm:w-[92vw] sm:max-w-[92vw] lg:max-w-250 max-h-[calc(100vh-1rem)] sm:max-h-[92vh] p-0 overflow-hidden rounded-[1.75rem] sm:rounded-3xl border-muted-foreground/10 bg-card/95 backdrop-blur-xl shadow-2xl h-[650px]">
        <DialogHeader className="pt-3 px-2 pb-2 sm:pt-4 sm:px-3">
          <CandidateHeader candidate={candidate} activeTab={activeTab} passing_threshold={passing_threshold ?? 0} setActiveTab={setActiveTab} />
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-4 sm:p-3">
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
        isSubmitting={isSubmitting}
      />
    </Dialog>
  );
}
