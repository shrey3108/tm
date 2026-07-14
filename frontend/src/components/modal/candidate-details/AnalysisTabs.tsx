import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export type AnalysisTab = "analysis" | "jd" | "cross-job-match" | "version-result";
/**
 * Props for {@link AnalysisTabs}.
 */
interface AnalysisTabsProps {
  activeTab: AnalysisTab;
  setActiveTab: (tab: AnalysisTab) => void;
}

/**
 * Tab switcher between the "Analysis", "JD Version", and "cross-job-match" views
 * inside the candidate details modal.
 */
export function AnalysisTabs({ activeTab, setActiveTab }: AnalysisTabsProps) {
  const commonStyle = "h-8 rounded-lg px-2 text-sm font-bold tracking-wider transition-all";
  const activeStyle = "bg-muted-foreground/15 dark:bg-muted-foreground/25 text-foreground shadow-sm";
  return (
    <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-muted-foreground/5 bg-background/50 p-1 sm:flex lg:w-auto">
      <Button
        variant={activeTab === "analysis" ? "secondary" : "ghost"}
        size="sm"
        className={cn(commonStyle, activeTab === "analysis" && activeStyle)}
        onClick={() => setActiveTab("analysis")}
      >
        Analysis
      </Button>
      <Button
        variant={activeTab === "jd" ? "secondary" : "ghost"}
        size="sm"
        className={cn(commonStyle, activeTab === "jd" && activeStyle)}
        onClick={() => setActiveTab("jd")}
      >
        JD Version
      </Button>
      <Button
        variant={activeTab === "cross-job-match" ? "secondary" : "ghost"}
        size="sm"
        className={cn(commonStyle, activeTab === "cross-job-match" && activeStyle)}
        onClick={() => setActiveTab("cross-job-match")}
      >
        Cross Job Match
      </Button>
      <Button
        variant={activeTab === "version-result" ? "secondary" : "ghost"}
        size="sm"
        className={cn(commonStyle, activeTab === "version-result" && activeStyle)}
        onClick={() => setActiveTab("version-result")}
      >
        Version Result
      </Button>
    </div>
  );
}
