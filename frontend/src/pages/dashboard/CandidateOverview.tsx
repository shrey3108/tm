import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, Building } from "lucide-react";
import {
  useResolvedJobAndCandidate,
  useCandidateTimelineQuery,
  useCandidateAssociateResultsQuery,
} from "@/hooks/queries/candidates/useCandidateStagesQueries";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { slugify } from "@/utils/slug";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";
import { Button } from "@/components/ui/button";
import type { TimelineEvent } from "@/types/candidate";

interface StageRowProps {
  event: TimelineEvent;
  jobSlug: string;
  candidateNameSlug: string;
}

function StageRow({ event, jobSlug, candidateNameSlug }: StageRowProps) {
  const navigate = useNavigate();
  const { data: associateResults } = useCandidateAssociateResultsQuery(event.stage_id);

  const handleNavigate = () => {
    navigate(
      `/dashboard/jobs/${jobSlug}/candidates/${candidateNameSlug}/stages/${slugify(
        event.title || "Resume Screening"
      )}`
    );
  };

  const hasAssociates = associateResults && associateResults.total_associates > 0;

  return (
    <TableRow className="hover:bg-muted/50 transition-colors border-b border-border/50">
      <TableCell className="p-2 text-sm text-foreground">
        {event.title}
      </TableCell>
      <TableCell className="p-3">
        {event.ai_result ? (
          <div
            onClick={handleNavigate}
            className="cursor-pointer flex items-center gap-2 w-fit hover:opacity-80 transition-opacity"
          >
            <CandidateStatusBadge status={event.ai_result} />
            {event.score !== null && event.score !== undefined && (
              <span className="text-xs font-bold">
                {event.score.toFixed(1)}
                {event.title === "Resume Screening" ? "%" : "/5"}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs font-medium">N/A</span>
        )}
      </TableCell>
      <TableCell className="p-2">
        {event.hr_decision ? (
          <div
            onClick={handleNavigate}
            className="cursor-pointer flex items-center gap-2 w-fit hover:opacity-80 transition-opacity"
          >
            <CandidateStatusBadge status={event.hr_decision} />
            {event.hr_score !== null && event.hr_score !== undefined && (
              <span className="text-xs font-bold">
                {event.hr_score.toFixed(1)}/5
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs font-medium">N/A</span>
        )}
      </TableCell>
      <TableCell className="p-2">
        {hasAssociates ? (
          <div
            onClick={handleNavigate}
            className="cursor-pointer flex items-center gap-2 w-fit hover:opacity-80 transition-opacity"
          >
            <Badge
              variant="outline"
              className="bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200/50 text-xs px-2 py-0.5"
            >
              {associateResults.submitted_count}/{associateResults.total_associates} Evaluated
            </Badge>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs font-medium">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function CandidateOverview() {
  const { jobSlug, candidateName } = useParams<{ jobSlug: string; candidateName: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { job, candidate, isLoading, error } = useResolvedJobAndCandidate({
    jobSlug,
    candidateNameSlug: candidateName,
    stateJob: location.state?.job,
    stateCandidateId: location.state?.candidateId,
  });

  const { data: timelineData, isLoading: isTimelineLoading } = useCandidateTimelineQuery(
    candidate?.id,
    job?.id
  );

  const handleBack = () => {
    navigate(`/dashboard/jobs/${jobSlug}/candidates`);
  };

  if (isLoading || isTimelineLoading) {
    return (
      <AppPageShell width="wide" className="p-4">
        <LoadingSpinner message="Loading candidate stage overview..." />
      </AppPageShell>
    );
  }

  if (error || !candidate || !job) {
    return (
      <AppPageShell width="wide" className="p-4 space-y-4">
        <div className="p-4 text-center border border-destructive/20 rounded-xl bg-destructive/5 text-destructive">
          Failed to resolve candidate and job details. Please try again.
        </div>
        <Button variant="outline" onClick={handleBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Candidates
        </Button>
      </AppPageShell>
    );
  }

  const candidateDisplayName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim();
  const stagesEvents = timelineData?.events.filter((e) => e.event_type === "stage") || [];

  return (
    <AppPageShell width="wide" className="animate-in fade-in duration-500 p-4 space-y-4">
      <AppPageHeader
        title={`${candidateDisplayName}'s Results Overview`}
        subtitle="Stage-wise recruitment breakdown including AI evaluations, HR decision audits, and associate reports."
        breadcrumbActions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border border-muted-foreground/10 px-4 font-semibold flex items-center gap-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Candidates
          </Button>
        }
      />

      <Card className="rounded-2xl border-muted-foreground/10 shadow-sm overflow-hidden bg-card/50 backdrop-blur-md p-4 flex flex-col gap-3">
        {/* improve later */}
        <div className="flex items-center gap-2 text-foreground font-bold">
          <User className="h-5 w-5 text-primary shrink-0" />
          <span className="text-base">Candidate Information</span>
        </div>
        <div className="border-b border-border/50" />
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-base font-bold text-foreground capitalize leading-none">
                {candidateDisplayName}
              </span>
              <span className="text-sm mt-1">
                {job.title}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              {candidate.email || "N/A"}
            </span>
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              {candidate.phone || "N/A"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-foreground">
            <Building className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>Department: {job.department_name || "N/A"}</span>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-muted-foreground/10 shadow-sm overflow-hidden bg-card/50 backdrop-blur-md py-1 gap-2">
        <CardHeader className="p-2 border-b border-border/50 bg-muted/20 pb-2 group-data-[size=sm]/card:[.border-b]:pb-2 [.border-b]:pb-2">
          {/* <CardTitle className="text-sm font-bold text-foreground/80"> */}
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground/80">
            Stage Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stagesEvents.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground italic">
              No recruitment stages found for this candidate.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border/50 font-semibold text-base">
                  <TableHead className="p-2 text-left">Stage Name</TableHead>
                  <TableHead className="p-2 text-left">AI Result</TableHead>
                  <TableHead className="p-2 text-left">HR Result</TableHead>
                  <TableHead className="p-2 text-left">Associate Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagesEvents.map((event) => (
                  <StageRow
                    key={event.stage_id || event.title}
                    event={event}
                    jobSlug={jobSlug || ""}
                    candidateNameSlug={candidateName || ""}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
