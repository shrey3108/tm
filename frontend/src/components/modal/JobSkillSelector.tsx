import ErrorDisplay from "@/components/shared/ErrorDisplay";
import type { SkillRead } from "@/types/skill";
import { Button } from "../ui/button";

interface JobSkillSelectorProps {
  skills: SkillRead[];
  selectedSkillIds: string[];
  loading: boolean;
  error: string | null;
  onToggleSkill: (skillId: string) => void;
  onAddSkill: () => void;
  errorMessage?: string;
}

const JobSkillSelector = ({
  skills,
  selectedSkillIds,
  loading,
  error,
  onToggleSkill,
  onAddSkill,
  errorMessage,
}: JobSkillSelectorProps) => {
  return (
    <div className="job-skills-section">
      <div className="flex justify-between items-center mb-2">
        <div>
          <label className="text-sm font-medium mb-0 block">Required Skills</label>
          <p className="text-muted text-sm mb-0">
            Select the skills that should be linked to this job.
          </p>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={onAddSkill}>
          Add Skill
        </Button>
      </div>

      {error && <ErrorDisplay message={error} />}

      <div className="border rounded p-3 bg-muted">
        {loading ? (
          <p className="text-center py-3">Loading skills...</p>
        ) : skills.length === 0 ? (
          <p className="text-center py-3 text-muted-foreground">
            No skills found yet. Add a skill to start linking jobs.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <label
                key={skill.id}
                className={`flex flex-col p-2 border rounded cursor-pointer ${selectedSkillIds.includes(skill.id)
                  ? "border-primary bg-primary/10"
                  : "bg-background"
                  }`}
                style={{ width: "calc(33.33% - 0.75rem)", minWidth: "150px" }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={selectedSkillIds.includes(skill.id)}
                    onChange={() => onToggleSkill(skill.id)}
                  />
                  <span className="font-semibold">{skill.name}</span>
                </div>
                <small className="text-muted-foreground truncate">
                  {skill.description || "No description"}
                </small>
              </label>
            ))}
          </div>
        )}
      </div>

      {errorMessage && <div className="text-destructive text-sm block mt-2">{errorMessage}</div>}
    </div>
  );
};

export default JobSkillSelector;
