import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, Briefcase, ArrowUpDown, MessageCircle } from "lucide-react";
import {
  useResolvedJobAndCandidate,
  useCandidateTimelineQuery,
  useCandidateAssociateResultsQuery,
} from "@/hooks/queries/candidates/useCandidateStagesQueries";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { slugify } from "@/utils/slug";
import { DataTable } from "@/components/shared/DataTable";
import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CandidateStatusBadge from "@/components/shared/CandidateStatusBadge";
import { Button } from "@/components/ui/button";
import type { TimelineEvent } from "@/types/timeline";
import { useMemo, useState } from "react";
import { AssociateEvaluationsDialog } from "@/components/candidate/timeline/AssociateEvaluationsDialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

function AssociateResultCell({
  event,
  jobSlug,
  candidateNameSlug,
}: {
  event: TimelineEvent;
  jobSlug: string;
  candidateNameSlug: string;
}) {
  const navigate = useNavigate();
  const { data: associateResults } = useCandidateAssociateResultsQuery(event.stage_id);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // instead of navigating to the stage, open dialog just for associate result only
  // @ts-ignore
  const handleNavigate = () => {
    navigate(
      `/dashboard/jobs/${jobSlug}/candidates/${candidateNameSlug}/stages/${slugify(
        event.title || "Resume Screening",
      )}`,
    );
  };

  const hasAssociates = associateResults && associateResults.total_associates > 0;

  if (hasAssociates) {
    return (
      <>
        <div
          onClick={() => setIsDialogOpen(true)}
          className="cursor-pointer flex items-center gap-2 w-fit hover:opacity-80 transition-opacity "
        >
          <Badge
            variant="outline"
            className="bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200/50 text-xs px-2 py-0.5"
          >
            {associateResults.submitted_count}/{associateResults.total_associates} Evaluated
          </Badge>
        </div>
        <AssociateEvaluationsDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          associateResults={associateResults}
        />
      </>
    );
  }

  return <span className="text-muted-foreground text-xs font-medium">-</span>;
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
    job?.id,
  );

  const currentStageIndex = useMemo(
    () =>
      timelineData?.events.findIndex((e) =>
        timelineData.current_stage ? e.title === timelineData.current_stage : null,
      ) ?? -1,
    [timelineData],
  );

  const handleBack = () => {
    navigate(`/dashboard/jobs/${jobSlug}/candidates`);
  };

  if (isLoading || isTimelineLoading) {
    return (
      <AppPageShell width="wide">
        <LoadingSpinner message="Loading candidate stage overview..." />
      </AppPageShell>
    );
  }

  if (error || !candidate || !job) {
    return (
      <AppPageShell width="wide">
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

  const columns: ColumnDef<TimelineEvent>[] = [
    {
      id: "order",
      size: 10,
      accessorFn: (_, index) => index,
      header: ({ column }) => (
        <div>
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base gap-1"
          >
            Stage No.
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-center font-medium">{row.index + 1}</div>
      ),
    },
    {
      accessorKey: "title",
      header: "Stage Name",
      size: 30,
      cell: ({ row }) => <span className="text-sm px-1">{row.original.title}</span>,
    },
    {
      id: "aiResult",
      header: () => <span className="text-left">AI Result</span>,
      size: 20,
      cell: ({ row }) => {
        const event = row.original;
        const isFutureStage = currentStageIndex !== -1 && row.index > currentStageIndex;

        if (event.ai_result && !isFutureStage) {
          return (
            <Link to={`/dashboard/jobs/${jobSlug}/candidates/${candidateName}/stages/${slugify(event.title || "Resume Screening")}`}
              className="cursor-pointer flex items-center justify-start gap-2 hover:opacity-80 transition-opacity" >
              <CandidateStatusBadge status={event.ai_result} />
              {event.score !== null && event.score !== undefined && (
                <span className="font-bold">
                  {event.score.toFixed(1)}
                  {event.title === "Resume Screening" ? "%" : "/5"}
                </span>
              )}
            </Link>

          );
        }
        return <span className="text-xs font-medium ">N/A</span>;
      },
    },
    {
      id: "hrResult",
      header: () => <span className="text-left">HR Result</span>,
      size: 20,
      cell: ({ row }) => {
        const event = row.original;
        const isFutureStage = currentStageIndex !== -1 && row.index > currentStageIndex;

        if (event.hr_decision && !isFutureStage) {
          return (
            <div className="flex items-center justify-start">
              <Link to={`/dashboard/jobs/${jobSlug}/candidates/${candidateName}/stages/${slugify(event.title || "Resume Screening")}`}
                className="cursor-pointer flex items-center justify-start gap-2 hover:opacity-80 transition-opacity" >

                <CandidateStatusBadge status={event.hr_decision} />
                {event.hr_score !== null && event.hr_score !== undefined && (
                  <span className="font-bold">{event.hr_score.toFixed(1)}/5</span>
                )}

              </Link>
              <HoverCard>
                <HoverCardTrigger delay={100} closeDelay={50}>
                  {event.hr_decision_notes && (
                    <MessageCircle className="h-4 w-5 ml-2 cursor-pointer" />
                  )}
                </HoverCardTrigger>
                <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                  <p>{event.hr_decision_notes}</p>
                </HoverCardContent>
              </HoverCard>
            </div>

          );
        }
        return <span className="text-xs font-medium ">N/A</span>;
      },
    },
    {
      id: "associateResult",
      header: "Associate Result",
      size: 20,
      cell: ({ row }) => {
        return (

          <AssociateResultCell
            event={row.original}
            jobSlug={jobSlug || ""}
            candidateNameSlug={candidateName || ""}
          />

        );
      },
    },
  ];


  return (
    <AppPageShell width="wide">
      <AppPageHeader
        title={`${candidateDisplayName}'s Results Overview`}
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

      <Card className="rounded-2xl border-muted-foreground/10 shadow-sm overflow-hidden bg-card/50 backdrop-blur-md p-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-foreground font-bold">
          <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-base text-foreground font-semibold">Candidate Information</span>
        </div>
        <div className="border-b border-border/50" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column 1: Name */}
          <div className="flex flex-col gap-1.5">
            <span className="font-bold">Name</span>
            <span className="text-sm font-bold text-foreground capitalize">
              {candidateDisplayName}
            </span>
          </div>

          {/* Column 2: Contact */}
          <div className="flex flex-col gap-1.5">
            <span className="font-bold">Contact</span>
            <div className="flex flex-col gap-1.5 text-xs sm:text-sm text-foreground">
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{candidate.email || "N/A"}</span>
              </span>
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{candidate.phone || "N/A"}</span>
              </span>
            </div>
          </div>

          {/* Column 3: Role & Department */}
          <div className="flex flex-col gap-1.5">
            <span className="font-bold">Role & Department</span>
            <div className="flex items-start gap-2">
              <Briefcase className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-foreground leading-none">{job.title}</span>
                {job.position?.name && (
                  <span className="text-xs capitalize leading-none">
                    Position: {job.position.name}
                  </span>
                )}
                {job.department_name && (
                  <span className="text-xs capitalize leading-none">
                    Dept: {job.department_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>


      {stagesEvents.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground italic">
          No recruitment stages found for this candidate.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={stagesEvents}
          isServerSide={false}
          minWidth="min-w-full"
          showPagination={false}
          emptyMessage=" No recruitment stages found for this candidate."
        />
      )}

    </AppPageShell>
  );
}
