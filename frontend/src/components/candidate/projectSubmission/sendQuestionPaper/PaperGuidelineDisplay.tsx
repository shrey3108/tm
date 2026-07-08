import { useGuidelines } from "@/hooks/queries/admin/useGuideline";
import { useMemo } from "react";
import { FileText } from "lucide-react";

interface PaperGuidelineDisplayProps {
  guidelineContent?: string | null;
}

export function PaperGuidelineDisplay({ guidelineContent }: PaperGuidelineDisplayProps) {
  const { data: guidelines } = useGuidelines({ skip: 0, limit: 100 });

  const guidelineData = useMemo(() => {
    if (guidelineContent) {
      return {
        content: guidelineContent,
        isDefault: false,
      };
    }
    if (guidelines && guidelines.length > 0) {
      const defaultGuideline = guidelines.find((g) => g.is_default);
      return {
        content: defaultGuideline ? defaultGuideline.content : guidelines[0].content,
        isDefault: true,
      };
    }
    return null;
  }, [guidelineContent, guidelines]);

  if (!guidelineData) return null;

  return (
    <div className="bg-card border border-border/80 p-2 shadow-xs space-y-0.5 animate-in fade-in duration-300 rounded-xl ">
      <div className="flex items-center justify-between ">
        <div className="flex items-center gap-2">
          <FileText className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Terms & Conditions
          </h4>
        </div>
        {/* <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-muted-foreground/20">
          {guidelineData.isDefault ? "Default Guideline" : "Assigned Guideline"}
        </span> */}
      </div>
      <div className="text-xs whitespace-pre-line p-1 max-h-40 overflow-y-auto">
        {guidelineData.content}
      </div>
    </div>
  );
}
