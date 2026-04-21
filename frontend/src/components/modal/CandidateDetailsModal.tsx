import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
import { AnalysisStats } from "@/components/modal/candidate-details/AnalysisStats";
import { AnalysisTabs, type AnalysisTab } from "@/components/modal/candidate-details/AnalysisTabs";
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
 * Allows HR users to approve, reject, or mark a candidate as "maybe" by submitting
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

  const form = useForm<CandidateDecisionFormValues>({
    resolver: zodResolver(candidateDecisionSchema),
    defaultValues: {
      note: "",
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
      adminJobService.getJobById(currentJobId).then((data) => {
        setJob(data as unknown as Job);
      });
    } else {
      setJob(null);
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
      candidateDecisionApi
        .getDecisionHistory(candidate.id, currentJobId)
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
        });
    } else {
      setHrDecision(null);
      setDecisionHistory([]);
    }
  }, [isOpen, candidate?.id, currentJobId]);

  if (!candidate) return null;

  const canTakeDecision =
    !hrDecision || hrDecision.decision.toLowerCase() === "may be";

  const handleAction = (type: "approve" | "reject" | "maybe") => {
    reset({
      decision: type,
      note: form.getValues("note") || "",
    });
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
        job_id: currentJobId,
      });
      setHrDecision(result);
      // Refresh history to include the new decision
      const historyResponse = await candidateDecisionApi.getDecisionHistory(
        candidate.id,
        currentJobId
      );
      setDecisionHistory(historyResponse.decisions);
      await onDecisionSubmitted?.();
      toast.success("Decision submitted successfully");
      setShowFeedbackModal(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col sm:w-[92vw] sm:max-w-[92vw] lg:max-w-250 max-h-[calc(100vh-1rem)] sm:max-h-[92vh] p-0 overflow-hidden rounded-[1.75rem] sm:rounded-3xl border-muted-foreground/10 bg-card/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="pt-3 px-2 pb-2 sm:pt-4 sm:px-3">
          <CandidateHeader candidate={candidate} />
        </DialogHeader>

        <div className="px-2 py-1.5 sm:px-4 border-y border-muted-foreground/10 bg-muted/20 flex flex-col items-start justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <AnalysisStats
            candidate={candidate}
            activeTab={activeTab}
            onVersionClick={() => setActiveTab("version-result")}
            passing_threshold={passing_threshold}
          />

          <div className="flex w-full items-center justify-center gap-3 sm:w-auto sm:justify-end">
            <Separator
              orientation="vertical"
              className="hidden h-10 bg-muted-foreground/10 sm:block"
            />
            <AnalysisTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-4 sm:p-3">
          {activeTab === "analysis" ? (
            <AnalysisContent
              candidate={candidate}
              showAllSkills={showAllSkills}
              setShowAllSkills={setShowAllSkills}
              jobId={currentJobId}
            >
              {hrDecision && hrDecision.decision.toLowerCase() !== "may be" && (
                <HrDecision decision={hrDecision} />
              )}
              <DecisionHistory decisions={decisionHistory} />
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

        {canTakeDecision && (
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
