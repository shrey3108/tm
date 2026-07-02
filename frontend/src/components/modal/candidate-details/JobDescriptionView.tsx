import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, History, AlertCircle } from "lucide-react";
import type { Job, JobVersionDetail } from "@/types/job";
import { DateDisplay } from "@/components/shared/DateDisplay";

/**
 * Props for {@link JobDescriptionView}.
 */
interface JobDescriptionViewProps {
  job: Job | null;
  selectedVersionData: JobVersionDetail | null;
  isLoadingVersion: boolean;
  onVersionChange: (val: string | null, eventDetails: any) => void;
  appliedVersionNumber?: number;
}

/**
 * Displays the job description for a specific version, with a version selector
 * dropdown. Highlights the version that was used for the candidate's analysis
 * and shows the latest version indicator.
 */
export function JobDescriptionView({
  job,
  selectedVersionData,
  isLoadingVersion,
  onVersionChange,
  appliedVersionNumber,
}: JobDescriptionViewProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-2 sm:p-4">
      {isLoadingVersion ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-bold text-muted-foreground">
            Loading JD Version...
          </p>
        </div>
      ) : selectedVersionData ? (
        <div className="space-y-3.5 rounded-[2.5rem] border border-border/80 bg-card/40 backdrop-blur-sm p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-0.5 md:pr-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <FileText className="h-5.5 w-5.5" />
              </div>
              <div className="flex min-w-0 flex-col">
                <h4 className="wrap-break-word text-base font-black tracking-tight sm:text-lg">
                  {selectedVersionData.title}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                  <span>Version {selectedVersionData.version_number}</span>
                  <span className="h-0.75 w-0.75 bg-muted-foreground/40 rounded-full" />
                  <span>
                    Updated{" "}
                    <DateDisplay date={selectedVersionData.created_at} className="text-xs" />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">


              {job?.job_versions && (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedVersionData?.id || ""}
                    onValueChange={onVersionChange}
                    modal={false}
                  >
                    <SelectTrigger className="h-8.5 rounded-xl border-border/60 bg-muted/30 px-3 text-[11px] font-bold hover:bg-muted/50 transition-colors w-45">
                      <div className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Version">
                          {selectedVersionData
                            ? `Version ${selectedVersionData.version_number}`
                            : "Version"}
                        </SelectValue>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/60 bg-popover/80 backdrop-blur-xl shadow-2xl" alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectLabel className="px-2 py-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                          JD History
                        </SelectLabel>
                        <Separator className="bg-border/40 my-1" />
                        {job.job_versions.map((ver) => (
                          <SelectItem
                            key={ver.id}
                            value={ver.id}
                            className="flex items-center justify-between rounded-xl px-2.5 py-2 transition-all hover:bg-primary/5 focus:bg-primary/5 group"
                          >
                            <div className="flex items-center gap-2 mr-4">
                              <span className="text-[12px] font-bold text-foreground/80 group-data-[state=checked]:text-primary">
                                Version {ver.version_num}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 pr-2">
                              {ver.version_num === appliedVersionNumber && (
                                <span className="rounded-md bg-primary text-primary-foreground px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm">
                                  Applied
                                </span>
                              )}

                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {appliedVersionNumber === selectedVersionData.version_number && (
                <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black tracking-wider text-primary border border-primary/20 whitespace-nowrap">
                  <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                  USED FOR ANALYSIS
                </div>
              )}
            </div>
          </div>



          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 sm:p-5">
            <p className="text-sm text-foreground/80 leading-relaxed font-medium whitespace-pre-wrap selection:bg-primary/20">
              {selectedVersionData.jd_text}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 grayscale opacity-40">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-bold">No JD version data available.</p>
        </div>
      )}
    </div>
  );
}
