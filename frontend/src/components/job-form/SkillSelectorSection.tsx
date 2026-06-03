import { useState, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { X, Plus, Check, Search, Loader2 } from "lucide-react";
import {
  FormField,
  FormItem,
  FormMessage,
  Input,
  Badge,
  Button,
} from "@/components";
import type { SkillRead } from "@/types/admin";
import { cn } from "@/lib/utils";
import { Required } from "@/components/job-form/Required";
import { CreateSkillModal } from "../modal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { useSkill } from "@/hooks/queries/admin/useSkill";

interface SkillSelectorSectionProps {
  initialSelectedSkills?: SkillRead[];
}

export const SkillSelectorSection = ({
  initialSelectedSkills = [],
}: SkillSelectorSectionProps) => {
  const { control, setValue } = useFormContext();
  const [skillSearch, setSkillSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillRead | null>(null);
  const selectedSkillIds = useWatch({
    control,
    name: "skill_ids",
    defaultValue: [],
  });

  const debouncedSearch = useDebouncedValue(skillSearch);

  const { data: skills, loading: isLoading, refetch: refetchSkills } = useSkill(0, 100, debouncedSearch);

  const displaySkills = skills;
  const toggleSkill = (skillId: string) => {
    const current = [...selectedSkillIds];
    const index = current.indexOf(skillId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(skillId);
    }
    setValue("skill_ids", current, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const selectedSkills = useMemo(() => {
    const pool = [...initialSelectedSkills, ...skills];
    const uniqueMap = new Map(pool.map((s) => [s.id, s]));
    return selectedSkillIds
      .map((id: string) => uniqueMap.get(id))
      .filter(Boolean) as SkillRead[];
  }, [initialSelectedSkills, skills, selectedSkillIds]);

  const filteredSkills = displaySkills;

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSkill(null);
  };
  return (
    <div className="app-surface-card space-y-6 p-4 sm:p-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>

            <h2 className="text-lg font-bold tracking-tight">Required Skills <Required /></h2>
            <p className="text-muted-foreground text-base font-medium">
              Select the skills that should be linked to this job. Click a skill to
              toggle selection.
            </p>
          </div>

          <Button
            onClick={() => setShowModal(true)}
            variant="secondary"
            size="sm"
            type="button"
          >
            <Plus />
            Add Skill
          </Button>
        </div>
        <FormField
          control={control}
          name="skill_ids"
          render={() => (
            <FormItem>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Skill Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search skills by name..."
          value={skillSearch}
          onChange={(e) => setSkillSearch(e.target.value)}
          className="pl-10 h-10 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-100 overflow-y-auto p-2 pr-4 custom-scrollbar">
        {filteredSkills.length > 0 ? (
          filteredSkills.map((skill) => {
            const isSelected = selectedSkillIds.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded-xl border-2 transition-all duration-300 text-left group",
                  isSelected
                    ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/5"
                    : "bg-background/50 border-muted-foreground/10 text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <span className="font-bold text-xs lg:text-sm mr-2 whitespace-normal leading-tight">
                  {skill.name}
                </span>

                <div
                  className={cn(
                    "shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground scale-110"
                      : "border-muted-foreground/20 group-hover:border-primary/50",
                  )}
                >
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="col-span-full py-10 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-muted-foreground/10">
            <p className="text-muted-foreground font-medium italic">
              {initialSelectedSkills.length === 0
                ? "No skills found in database."
                : "No skills match your search."}
            </p>
          </div>
        )}
      </div>

      {selectedSkillIds.length > 0 && (
        <div className="pt-6 border-t border-muted-foreground/10">
          <p className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">
            Selected ({selectedSkillIds.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedSkills.map((skill) => (
              <Badge
                key={skill.id}
                variant="secondary"
                className="pl-2 pr-1 py-1 text-sm rounded-xl bg-primary/20 text-primary border-none font-bold animate-in zoom-in duration-300"
              >
                {skill.name}
                <button
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className="ml-2 hover:bg-primary/20 rounded-full p-1 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
      <CreateSkillModal show={showModal} handleClose={handleCloseModal}
        onSkillSaved={refetchSkills}
        skill={selectedSkill} />
    </div>
  );
};
