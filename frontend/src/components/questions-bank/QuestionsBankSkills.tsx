import { Badge } from "@/components/ui/badge";

export interface PaperSkill {
  id: string;
  name: string;
}

export interface QuestionPaper {
  id: string;
  skills: PaperSkill[];
}

interface QuestionsBankSkillsProps {
  firstPaper: QuestionPaper;
  refetchPapers?: () => void;
}

export function QuestionsBankSkills({
  firstPaper,
}: QuestionsBankSkillsProps) {
  const firstPaperSkills = firstPaper?.skills || [];

  return (
    <div className="mt-2">
      <div className="border border-border bg-card rounded-xl p-3 space-y-2">
        <div className="flex flex-col items-start gap-1">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Linked Tech Stack Skills</h3>
          <p className="text-xs text-muted-foreground font-medium">
            Skills automatically extracted or linked to this question template set.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center pt-1">
          {firstPaperSkills.length > 0 ? (
            firstPaperSkills.map((skill) => (
              <Badge
                key={skill.id}
                variant="secondary"
                className="pl-2 pr-2 py-0.5 rounded-full bg-primary/10 text-primary border-none font-bold text-xs"
              >
                {skill.name}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">No skills linked yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}
