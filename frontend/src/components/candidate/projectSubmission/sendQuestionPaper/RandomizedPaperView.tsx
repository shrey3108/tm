import { HelpCircle } from "lucide-react";

interface RandomizedPaperViewProps {
  jobTitle?: string;
  positionName?: string;
}

export function RandomizedPaperView({
  jobTitle,
  positionName,
}: RandomizedPaperViewProps) {
  return (
    <div className="p-2.5 rounded-xl border border-border/40 bg-muted/20 space-y-1.5 animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-foreground">
            Randomized Generation Mode
          </h4>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            This will automatically select 5 unique questions at random from all
            available templates uploaded for the{" "}
            <span className="font-semibold text-foreground capitalize">
              {jobTitle || "Job Title"}
            </span>{" "}
            job role (experience level:{" "}
            <span className="font-semibold text-foreground capitalize">
              {positionName || "Position Level"}
            </span>
            ), and select an associated project task.
          </p>
        </div>
      </div>
    </div>
  );
}
