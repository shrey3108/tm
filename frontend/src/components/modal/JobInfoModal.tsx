/**
 * @fileoverview Modal component for displaying detailed information about a job position,
 * including its description, required skills, and hiring stages.
 */

import { InfoLabel } from "@/components/shared/InfoLabel";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { useJobVersion } from "@/hooks/queries/jobs/useJob";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/job";
import { slugify } from "@/utils/slug";
import { Check, Edit2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Props for the JobInfoModal component.
 */
interface JobInfoModalProps {
  /** Whether the modal is currently open. */
  isOpen: boolean;
  /** Callback function triggered when the modal is requested to close. */
  onClose: () => void;
  /** The job object to display information for, or null if no job is selected. */
  job: Job | null;
}

/**
 * A reusable section component for displaying structured information within the JobInfoModal.
 *
 * @param props - Component props.
 * @param props.title - The heading for the section.
 * @param props.children - The content to be rendered within the section.
 * @param props.className - Optional additional CSS classes for the card container.
 * @param props.titleClassName - Optional additional CSS classes for the title.
 * @param props.action - Optional action element (e.g., version picker) to display in the header.
 */
const InfoSection = ({
  title,
  children,
  className = "",
  titleClassName = "",
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  action?: React.ReactNode;
}) => (
  <Card
    size="sm"
    className={cn(
      "border-muted-foreground/10 bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20",
      className,
    )}
  >
    <CardHeader>
      <CardTitle className={cn("text-sm font-black", titleClassName)}>
        {title}
      </CardTitle>
      {action ? <CardAction>{action}</CardAction> : null}
    </CardHeader>
    <CardContent>
      <div className="text-sm font-medium">{children}</div>
    </CardContent>
  </Card>
);

/**
 * A modal dialog that displays comprehensive details about a specific job.
 *
 * Features include:
 * - Version history for job descriptions with the ability to switch between versions.
 * - Display of required skills as badges.
 * - Key metrics like passing threshold and vacancy.
 * - Visualization of the hiring process stages.
 * - Direct link to edit the job.
 *
 * @param props - The component props.
 * @returns A dialog component showing job details, or null if no job is provided.
 *
 */
export function JobInfoModal({ isOpen, onClose, job }: JobInfoModalProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const navigate = useNavigate();
  const sortedVersions = useMemo(() => {
    return [...(job?.job_versions || [])].sort((a, b) => b.version_num - a.version_num);
  }, [job?.job_versions]);

  // Fetch selected version using TanStack Query
  const { data: selectedVersion, loading: isLoadingVersion } = useJobVersion(
    selectedVersionId,
    isOpen && !!selectedVersionId
  );

  useEffect(() => {
    if (isOpen && job) {
      // Initialize with latest version or current job info
      if (sortedVersions.length > 0) {
        setSelectedVersionId(
          job.processing_version
            ? sortedVersions.filter(({ version_num }) => version_num == job.processing_version)[0]
              .id
            : sortedVersions[0].id,
        );
      } else {
        setSelectedVersionId(null);
      }
    } else {
      setSelectedVersionId(null);
    }
  }, [isOpen, job]);

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
        <DialogHeader className="p-2 pb-1 border-b border-muted-foreground/10 bg-muted/30">
          <div className="flex flex-col items-start justify-between gap-1">
            <DialogTitle className="text-lg font-black tracking-tight text-foreground capitalize flex flex-row items-center justify-between gap-2 ">
              {job.title}
              <Button
                size={"icon-sm"}
                variant={"outline"}
                className="rounded-lg"
                onClick={() =>
                  navigate(`/dashboard/jobs/${slugify(job.title)}/edit`, {
                    state: { jobId: job.id },
                  })
                }
              >
                <HoverCard>
                  <HoverCardTrigger delay={10} closeDelay={10}>
                    <Edit2 />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="right">
                    Edit Job
                  </HoverCardContent>
                </HoverCard>
              </Button>
            </DialogTitle>
            <div className="flex flex-row items-center justify-center gap-2.5  sm:justify-start sm:items-start">
              {job.department_name && (
                <span className="text-sm font-semibold text-blue-500 capitalize">
                  {job.department_name}
                </span>
              )}
              <Badge
                variant={job.is_active ? "default" : "outline"}
                className="rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
              >
                {job.is_active ? "Active" : "Inactive"}
              </Badge>
              <div className="flex flex-row items-center justify-center gap-1">
                <span>Due Date:</span>
                <span className="font-bold">
                  <DateDisplay date={job.priority_end_date} fallback="No due date" />
                </span>
                {/* priority name  */}
                {/* {job.priority?.name && (
                  <span

                    className="rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                  >
                    {job.priority?.name}
                  </span>
                )} */}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 p-2 overflow-y-auto overflow-x-hidden min-h-0 bg-muted/5">
          <div className="space-y-4 pb-4">
            {/* Job Description Card */}
            <InfoSection
              title="Job Description"
              action={
                sortedVersions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sortedVersions.map((v) => {
                      const isProcessing = job.processing_version === v.version_num;
                      const button = (
                        <Button
                          key={v.id}
                          variant={selectedVersionId === v.id ? "default" : "secondary"}
                          size="sm"
                          onClick={() => setSelectedVersionId(v.id)}
                          className={cn(
                            "rounded-full h-7 px-3 text-[10px] font-bold uppercase transition-all",
                            selectedVersionId === v.id
                              ? "border border-primary shadow-sm"
                              : "opacity-70 hover:opacity-100",
                          )}
                        >
                          V{v.version_num} {isProcessing && <Check className="w-2.5 h-2.5 ml-1" />}
                        </Button>
                      );

                      if (isProcessing) {
                        return (
                          <HoverCard key={v.id}>
                            <HoverCardTrigger>{button}</HoverCardTrigger>
                            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                              This version is currently being processed.
                            </HoverCardContent>
                          </HoverCard>
                        );
                      }

                      return button;
                    })}
                  </div>
                )
              }
            >
              {isLoadingVersion ? (
                <div className="h-40 w-full rounded-xl bg-muted/20 animate-pulse flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    Loading specific version...
                  </span>
                </div>
              ) : selectedVersion?.jd_text || job.jd_text ? (
                <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed py-1">
                  {selectedVersion?.jd_text || job.jd_text}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic py-1">
                  No description provided.
                </div>
              )}
            </InfoSection>

            {/* Required Skills Card */}
            {job.skills && job.skills.length > 0 ? (
              <InfoSection title="Required Skills">
                <div className="flex flex-wrap gap-2 py-1">
                  {job.skills.map((skill) => (
                    <Badge
                      key={skill.name}
                      variant="secondary"
                      className="rounded-xl px-1.5 py-1 text-xs font-semibold bg-secondary/40 hover:bg-secondary text-secondary-foreground border-muted-foreground/5 transition-colors"
                    >
                      {skill.name}{" - "} {skill.default_weightage}%
                    </Badge>
                  ))}
                </div>
              </InfoSection>
            ) : null}

            {/* Key Information Row */}
            <Card className="border-muted-foreground/10 bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20 p-1">
              <div className="flex flex-wrap items-center gap-x-10 gap-y-4 px-2 py-1 ">
                <InfoLabel
                  label="Passing Threshold"
                  value={`${job.passing_threshold}%`}
                />
                <InfoLabel
                  label="Question Passing Threshold"
                  value={`${job.question_bank_passing_threshold}%`}

                />
                <Separator orientation="vertical" className="h-12 bg-gray-300" />
                <InfoLabel label="Vacancy" value={job.vacancy} valueClassName="text-base" />
                <Separator orientation="vertical" className="h-12 bg-gray-300" />
                <InfoLabel
                  label="Position Level"
                  value={job.position?.name || "N/A"}

                />
                <Separator orientation="vertical" className="h-12 bg-gray-300" />
              </div>
            </Card>
            {/* Job Stages Card */}
            <InfoSection title="Job Stages">
              <div className="flex flex-wrap gap-2 py-1 flex-col">
                {job?.stages?.map((stage, idx) => (
                  <div key={stage.id} className="flex items-center gap-2 ">
                    <div className="flex  items-center justify-center w-6 h-6 rounded-full  text-sm font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold text-foreground/80">
                      {stage.template?.name}
                    </span>
                    {idx < (job.stages?.length || 0) - 1 && (
                      <div className="h-px w-4 bg-muted-foreground/20 mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </InfoSection>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JobInfoModal;
