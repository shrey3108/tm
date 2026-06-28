import { useState, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Plus, Check, Search, Loader2, X } from "lucide-react";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import type { SkillRead } from "@/types/skill";
import { cn } from "@/lib/utils";
import { Required } from "@/components/shared/Required";
import CreateSkillModal from "@/components/modal/CreateSkillModal";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { useSkill } from "@/hooks/queries/admin/useSkill";

interface SkillSelectorSectionProps {
  initialSelectedSkills?: SkillRead[];
  placeholderMessage?: string
}

export const SkillSelectorSection = ({
  initialSelectedSkills = [],
  placeholderMessage = "Select the skills that should be linked to this job."
}: SkillSelectorSectionProps) => {
  const { control, setValue } = useFormContext();
  const [allSkills, setAllSkills] = useState<SkillRead[]>(initialSelectedSkills);
  const [prevSkills, setPrevSkills] = useState<SkillRead[]>([]);
  const [prevInitialSelectedSkills, setPrevInitialSelectedSkills] = useState<SkillRead[]>(initialSelectedSkills);



  const [skillSearch, setSkillSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillRead | null>(null);
  const selectedSkillIds = useWatch({
    control,
    name: "skill_ids",
    defaultValue: [],
  });
  const skillWeightages = useWatch({
    control,
    name: "skill_weightages",
    defaultValue: {},
  }) || {};

  const debouncedSearch = useDebouncedValue(skillSearch);

  const { data: skills, loading: isLoading, refetch: refetchSkills } = useSkill(0, 100, debouncedSearch);

  // If skills or initialSelectedSkills changed, we update allSkills and the prev state synchronously during render
  if (skills !== prevSkills || initialSelectedSkills !== prevInitialSelectedSkills) {
    setPrevSkills(skills);
    setPrevInitialSelectedSkills(initialSelectedSkills);

    const uniqueMap = new Map<string, SkillRead>();
    allSkills.forEach((s) => uniqueMap.set(s.id, s));
    initialSelectedSkills.forEach((s) => uniqueMap.set(s.id, s));
    skills.forEach((s) => uniqueMap.set(s.id, s));
    const merged = Array.from(uniqueMap.values());

    if (merged.length !== allSkills.length || merged.some((s, idx) => s.id !== allSkills[idx]?.id)) {
      setAllSkills(merged);
    }
  }

  const toggleSkill = (skillId: string) => {
    const current = [...selectedSkillIds];
    const currentWeightages = { ...skillWeightages };
    const index = current.indexOf(skillId);
    if (index > -1) {
      current.splice(index, 1);
      delete currentWeightages[skillId];
    } else {
      current.push(skillId);
      const skillObj = allSkills.find((s) => s.id === skillId);
      currentWeightages[skillId] = skillObj?.default_weightage ?? 10;
    }
    setValue("skill_ids", current, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("skill_weightages", currentWeightages, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };


  const selectedSkills = useMemo(() => {
    const uniqueMap = new Map(allSkills.map((s) => [s.id, s]));
    return selectedSkillIds
      .map((id: string) => uniqueMap.get(id))
      .filter(Boolean) as SkillRead[];
  }, [allSkills, selectedSkillIds]);


  const filteredSkills = useMemo(() => {
    const selectedMap = new Map(selectedSkills.map((s) => [s.id, s]));
    if (!skillSearch.trim()) {
      const nonSelected = skills.filter((s) => !selectedMap.has(s.id));
      return [...selectedSkills, ...nonSelected];
    }
    const query = skillSearch.toLowerCase();
    const matched = allSkills.filter((skill) =>
      skill.name.toLowerCase().includes(query) || (skill.description && skill.description.toLowerCase().includes(query))
    );
    const matchedSelected = matched.filter((s) => selectedMap.has(s.id));
    const matchedNonSelected = matched.filter((s) => !selectedMap.has(s.id));
    return [...matchedSelected, ...matchedNonSelected];
  }, [skills, allSkills, skillSearch, selectedSkills]);

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSkill(null);
  };
  return (
    <div className="app-surface-card space-y-6 p-4 sm:p-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="w-full mr-4">

            <h2 className="text-lg font-bold tracking-tight">Required Skills <Required /></h2>
            <p className="text-muted-foreground text-base font-medium">
              <div className="flex items-center justify-between">
                <span>{placeholderMessage}</span>
                {selectedSkillIds.length > 0 ? <span className="text-primary text-sm font-bold">
                  Selected ({selectedSkillIds.length})
                </span> : null}
              </div>
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
        <div className="pt-6 border-t border-muted-foreground/10 space-y-4 animate-in fade-in duration-300">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Selected Skills & Custom Weightages ({selectedSkillIds.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {selectedSkills.map((skill) => {
              const weightageValue = skillWeightages[skill.id] ?? skill.default_weightage ?? 10;
              return (
                <div
                  key={skill.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-muted-foreground/20 bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex flex-col min-w-0 mr-2">
                    <span className="font-bold text-sm truncate">{skill.name}</span>
                    <span className="text-xs text-muted-foreground italic">
                      Default: {skill.default_weightage ?? 10}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">Weight:</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={weightageValue}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const currentWeightages = { ...skillWeightages };
                          currentWeightages[skill.id] = val;
                          setValue("skill_weightages", currentWeightages, {
                            shouldValidate: true,
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                        }}
                        className="w-20 h-8 text-center text-sm font-bold p-1 rounded-lg border-muted-foreground/20"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <CreateSkillModal show={showModal} handleClose={handleCloseModal}
        onSkillSaved={refetchSkills}
        skill={selectedSkill} />
    </div>
  );
};
