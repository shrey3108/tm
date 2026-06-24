import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SkillRead } from "@/types/admin";

/**
 * Props for the SkillsBadgeList component.
 */
interface SkillsBadgeListProps {
  /** Optional array of skill objects */
  skills?: (SkillRead | { name: string; description: string | null })[];
  /** Additional CSS class name */
  className?: string;
  /** Whether to show a label when no skills are found (default: "N/A") */
  emptyLabel?: string;
  /** Maximum number of skills to show before collapsing (default: 3) */
  maxVisible?: number;
}

/**
 * Badge list for displaying skills with a tooltip for extra skills.
 * @example
 * ```tsx
 * <SkillsBadgeList skills={job.skills} />
 * ```
 */
const SkillsBadgeList = ({
  skills,
  className = "",
  emptyLabel = "N/A",
  maxVisible = 2,
}: SkillsBadgeListProps) => {
  if (!skills || skills.length === 0) {
    return (
      <span className={cn("text-muted-foreground text-xs italic", className)}>{emptyLabel}</span>
    );
  }

  const visibleSkills = skills.slice(0, maxVisible);
  const remainingSkills = skills.slice(maxVisible);

  return (
    <TooltipProvider delay={200}>
      <div className={cn("flex flex-wrap gap-1.5 items-start", className)}>
        {visibleSkills.map((skill, index) => (
          <Badge
            key={"id" in skill ? skill.id : `${skill.name}-${index}`}
            variant="secondary"
            className="text-sm font-normal px-1.5 py-0.5 rounded-md border-muted-foreground/20 overflow-visible whitespace-normal [word-break:break-word] leading-snug h-auto"
          >
            {skill.name}
          </Badge>
        ))}
        {remainingSkills.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <Badge
                  {...props}
                  variant="outline"
                  className="text-sm font-normal h-5 px-1.5 rounded-md border-muted-foreground/20"
                >
                  +{remainingSkills.length} more
                </Badge>
              )}
            />
            <TooltipContent
              side="top"
              className="flex flex-col gap-1 p-2 bg-popover text-popover-foreground border shadow-md"
            >
              <div className="text-sm font-semibold border-b pb-1 mb-1 border-border/50">
                Additional Skills
              </div>
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {remainingSkills.map((skill, index) => (
                  <span
                    key={"id" in skill ? skill.id : `${skill.name}-${index}`}
                    className="px-0.5 py-0.5 rounded bg-muted text-xs font-medium"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SkillsBadgeList;
