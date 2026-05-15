import { useState, useEffect, useMemo } from "react";
import jobService from "@/apis/job";
import type { Job, JobVersionDetail } from "@/types/job";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { InfoLabel } from "@/components/shared";
import { Separator } from "../ui/separator";

interface JobInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
}

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
  <Card size="sm" className={cn("border-muted-foreground/10 bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20", className)}>
    <CardHeader>
      <CardTitle className={cn("text-sm font-black text-muted-foreground ", titleClassName)}>
        {title}
      </CardTitle>
      {action ? <CardAction>{action}</CardAction> : null}
    </CardHeader>
    <CardContent>
      <div className="text-sm font-medium">
        {children}
      </div>
    </CardContent>
  </Card>
);

export function JobInfoModal({ isOpen, onClose, job }: JobInfoModalProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<JobVersionDetail | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);

  const sortedVersions = useMemo(() => {
    return [...(job?.job_versions || [])].sort((a, b) => b.version_num - a.version_num);
  }, [job?.job_versions]);

  useEffect(() => {
    if (isOpen && job) {
      // Initialize with latest version or current job info
      if (sortedVersions.length > 0) {
        setSelectedVersionId(job.processing_version ? sortedVersions.filter(({ version_num }) => version_num == job.processing_version)[0].id : sortedVersions[0].id);
      } else {
        // Fallback to current job data if no versions
        setSelectedVersion({
          id: "current",
          job_id: job.id,
          version_number: job.version || 1,
          title: job.title,
          jd_text: job.jd_text,
          jd_json: job.jd_json,
          custom_extraction_fields: job.custom_extraction_fields || null,
          created_at: job.created_at,
        });
      }
    } else {
      setSelectedVersionId(null);
      setSelectedVersion(null);
    }
  }, [isOpen, job]);

  useEffect(() => {
    if (selectedVersionId && job) {
      if (selectedVersionId === "current") return;

      setIsLoadingVersion(true);
      jobService.getJobVersion(selectedVersionId)
        .then((data) => setSelectedVersion(data))
        .catch((err) => console.error("Failed to fetch version:", err))
        .finally(() => setIsLoadingVersion(false));
    }
  }, [selectedVersionId, job]);

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
        <DialogHeader className="p-2 pb-2 border-b border-muted-foreground/10 bg-muted/30">
          <div className="flex flex-col items-start justify-between gap-4">
            <DialogTitle className="text-xl font-black tracking-tight text-foreground capitalize">
              {job.title}
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
                  <DateDisplay
                    date={job.priority_end_date}
                    fallback="No due date"
                  />
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

        <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden min-h-0 bg-muted/5">
          <div className="space-y-4 pb-4">
            {/* Job Description Card */}
            <InfoSection
              title="Job Description"
              action={sortedVersions.length > 0 && (
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
                          selectedVersionId === v.id ? "border border-primary shadow-sm" : "opacity-70 hover:opacity-100"
                        )}
                      >
                        V{v.version_num} {isProcessing && <Check className="w-2.5 h-2.5 ml-1" />}
                      </Button>
                    );

                    if (isProcessing) {
                      return (
                        <HoverCard key={v.id}>
                          <HoverCardTrigger>
                            {button}
                          </HoverCardTrigger>
                          <HoverCardContent className="w-fit p-3 text-xs font-medium">
                            This version is currently being processed.
                          </HoverCardContent>
                        </HoverCard>
                      );
                    }

                    return button;
                  })}
                </div>
              )}
            >
              {isLoadingVersion ? (
                <div className="h-40 w-full rounded-xl bg-muted/20 animate-pulse flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">Loading specific version...</span>
                </div>
              ) : (selectedVersion?.jd_text || job.jd_text) ? (
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
                      className="rounded-xl px-3 py-1 text-xs font-semibold bg-secondary/40 hover:bg-secondary text-secondary-foreground border-muted-foreground/5 transition-colors"
                      title={skill.description || undefined}
                    >
                      {skill.name}
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
                  valueClassName="text-base"
                />
                <Separator orientation="vertical" className="h-12 bg-gray-300" />
                <InfoLabel
                  label="Vacancy"
                  value={job.vacancy}
                  valueClassName="text-base"
                />
                <Separator orientation="vertical" className="h-12 bg-gray-300" />
                <InfoLabel
                  label="Position Level"
                  value={job.position?.name || "N/A"}
                  valueClassName="text-base"
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
