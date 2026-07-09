import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { CandidateResponse } from "@/types/resume";
import type { CandidateAnalysis, CandidateMatchAnalysis } from "@/types/admin";
import type { ReactNode } from "react";

/**
 * Props for {@link AnalysisContent}.
 */
interface AnalysisContentProps {
  candidate: CandidateResponse | CandidateAnalysis;
  showAllSkills: boolean;
  setShowAllSkills: (show: boolean) => void;
  /** Optional override for analysis data (used for historical results) */
  analysisOverride?: CandidateMatchAnalysis | null;
  /** Optional current job ID to match against version_results */
  jobId?: string | null;
  children?: ReactNode;
}

/**
 * Main analysis view showing strength summary, experience alignment,
 * missing skills (with expand/collapse), and extraordinary points.
 * Accepts a `children` slot so the parent can inject a screening-decision card.
 */
export function AnalysisContent({
  candidate,
  showAllSkills,
  setShowAllSkills,
  analysisOverride,
  jobId,
  children,
}: AnalysisContentProps) {
  const analysis = (() => {
    // 1. If override is explicitly provided, use it
    if (analysisOverride !== undefined) return analysisOverride;

    // 2. If jobId is provided, try to find matching analysis in version_results
    if (jobId && candidate.version_results) {
      const match = candidate.version_results.find(
        (vr) => vr.job_id === jobId
      );
      if (match?.analysis_data) return match.analysis_data;
    }

    // 3. Fallback to top-level resume_analysis
    return candidate.resume_analysis;
  })();

  return (
    <div className="space-y-1">
      {/* Summary Sections */}
      <div className="grid grid-cols-1 gap-3">
        <section className="space-y-2">
          <Card className="text-muted-foreground text-base leading-relaxed p-2 gap-1">
            <h3 className="text-lg font-medium tracking-tight flex items-center gap-2 text-foreground">
              Strength Summary
            </h3>
            {analysis?.strength_summary || "No summary available."}
          </Card>
        </section>

        <section className="space-y-2">
          <Card className="text-muted-foreground text-base leading-relaxed p-2 gap-1">
            <h3 className="text-lg font-medium tracking-tight flex items-center gap-2 text-foreground">
              Experience Alignment
            </h3>
            {analysis?.experience_alignment ||
              "No alignment details available."}
          </Card>
        </section>
      </div>

      {children}

      {/* Custom Extractions */}
      {analysis?.custom_extractions &&
        Object.keys(analysis.custom_extractions).length > 0 && (
          <section className="space-y-2 pt-2">
            <h3 className="text-lg tracking-tight flex items-center gap-2 text-foreground px-1 font-medium">
              Custom Information
            </h3>
            <ul className="flex flex-col gap-1.5 px-2 pb-1 list-none">
              {Object.entries(analysis.custom_extractions).map(([key, value]) => (
                <li
                  key={key}
                  className="flex items-baseline gap-2 group"
                >
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {key}:
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {String(value || "N/A")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

      {/* Skills & Extraordinary Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <section className="space-y-2">
          <h3 className="text-lg font-medium tracking-tight flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">
              Missing Skills
            </span>
          </h3>

          <div className="space-y-3">
            <ul className="list-disc pl-4">
              {analysis?.missing_skills && analysis.missing_skills.length > 0 ? (
                <>
                  {(showAllSkills
                    ? analysis.missing_skills
                    : analysis.missing_skills.slice(0, 4)
                  ).map((skill, idx) => (
                    <li
                      key={idx}
                      className="text-sm"
                    >
                      <span className="text-black dark:text-white">
                        {skill.name}
                      </span>
                    </li>
                  ))}
                  {analysis.missing_skills.length > 4 && (
                    <div className="flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[50%] text-xs font-bold  hover:bg-black/5 dark:hover:bg-white/5 mt-2 border border-black dark:border-white"
                        onClick={() => setShowAllSkills(!showAllSkills)}
                      >
                        {showAllSkills
                          ? "Show Less"
                          : `Show ${analysis.missing_skills.length - 4} More`}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <li className="text-sm text-muted-foreground font-medium">
                  No major missing skills identify.
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-lg font-medium tracking-tight flex items-center gap-2 text-foreground">
            Extraordinary Points
          </h3>
          <ul className="list-disc sm:pl-4">
            {analysis?.extraordinary_points &&
              analysis.extraordinary_points.length > 0 ? (
              analysis.extraordinary_points.map((point, idx) => (
                <li
                  key={idx}
                  className="text-sm"
                >
                  <span className="text-black dark:text-white">
                    {point}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm font-medium text-muted-foreground">
                No extraordinary points found from the resume.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
