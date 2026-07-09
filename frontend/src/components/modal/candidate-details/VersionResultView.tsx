import { useState, useMemo } from "react";
import { History } from "lucide-react";
import type { CandidateAnalysis, CandidateMatchAnalysis } from "@/types/admin";
import type { Job } from "@/types/job";
import { AnalysisContent } from "./AnalysisContent";
import { SearchableSelect } from "@/components/shared/SearchableSelect";

interface VersionResultViewProps {
  candidate: CandidateAnalysis;
  job: Job | null;
  showAllSkills: boolean;
  setShowAllSkills: (show: boolean) => void;
}

interface VersionResultEntry {
  version: number;
  score: number;
  analysis: CandidateMatchAnalysis | null;
  timestamp: string;
}

/**
 * VersionResultView Component
 * 
 * Displays screening results filtered by JD versions on which the resume was processed.
 * Reuses AnalysisContent to maintain a consistent UI across analysis views.
 */
export function VersionResultView({
  candidate,
  job,
  showAllSkills,
  setShowAllSkills
}: VersionResultViewProps) {

  const results = useMemo(() => {
    // Get version results from backend 
    const rawResults = (candidate as any).version_results || [];

    // Filter by current job_id to avoid showing versions from other jobs
    // We also map it to our internal UI format
    const list: VersionResultEntry[] = rawResults
      .filter((vr: any) => !job || vr.job_id === job.id)
      .map((vr: any) => ({
        version: vr.job_version_number,
        score: vr.resume_score || 0,
        analysis: vr.analysis_data,
        timestamp: vr.analyzed_at || (candidate as any).created_at
      }));

    // Ensure the currently applied version is present 
    const currentVersion = (candidate as any).applied_version_number;
    const hasCurrent = list.some((r) => r.version === currentVersion);

    if (currentVersion && !hasCurrent) {
      list.push({
        version: currentVersion,
        score: candidate.resume_score || 0,
        analysis: candidate.resume_analysis || null,
        timestamp: (candidate as any).created_at
      });
    }

    // fallback for safety
    if (list.length === 0) {
      list.push({
        version: currentVersion || 1,
        score: candidate.resume_score || 0,
        analysis: candidate.resume_analysis || null,
        timestamp: (candidate as any).created_at
      });
    }

    // Final deduplication to ensure each version number appears only once
    const dedupedMap = new Map<number, VersionResultEntry>();
    list.forEach((item) => {
      const existing = dedupedMap.get(item.version);
      // Keep the one that has analysis data if available
      if (!existing || (!existing.analysis && item.analysis)) {
        dedupedMap.set(item.version, item);
      }
    });

    const finalResults = Array.from(dedupedMap.values());
    return finalResults.sort((a, b) => b.version - a.version);
  }, [candidate, job]);

  const [selectedVersion, setSelectedVersion] = useState(String(results[0].version));

  const options = useMemo(() => {
    return results.map((r) => ({
      id: String(r.version),
      label: `Version ${r.version}`,
    }));
  }, [results]);

  const activeResult = useMemo(() =>
    results.find((r) => String(r.version) === selectedVersion) || results[0],
    [selectedVersion, results]);

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2">
        <div className="space-y-0.5">
          <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            JD Version Result
          </h3>
          <p className="text-sm text-muted-foreground leading-none">
            Historical screening performance for this candidate.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-muted/40 p-1.5 rounded-xl border border-muted-foreground/10 px-3.5 sm:mr-1">
          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider whitespace-nowrap">
            Select Version:
          </span>
          <SearchableSelect
            value={selectedVersion}
            onValueChange={(val) => val && setSelectedVersion(val)}
            options={options}
            placeholder="Version"
            searchPlaceholder="Search versions..."
            triggerClassName="w-fit min-w-25 rounded-lg border-muted-foreground/5 h-8 text-xs font-bold shadow-none bg-background gap-2"
            contentClassName="rounded-xl border-muted-foreground/10"
          />
        </div>
      </div>

      <div className="relative min-h-[400px]">
        <div className="animate-in fade-in duration-700">
          {activeResult.analysis ? (
            <AnalysisContent
              candidate={candidate}
              showAllSkills={showAllSkills}
              setShowAllSkills={setShowAllSkills}
              analysisOverride={activeResult.analysis}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/10 rounded-2xl border-2 border-dashed border-muted-foreground/10">
              <div className="p-4 bg-muted/30 rounded-full mb-4">
                <History className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <h4 className="text-sm font-bold text-foreground mb-1">Detailed Analysis Archived</h4>
              <p className="text-xs text-muted-foreground italic max-w-[280px]">
                Archived analysis breakdown for JD Version {activeResult.version} is not available in the current history.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
