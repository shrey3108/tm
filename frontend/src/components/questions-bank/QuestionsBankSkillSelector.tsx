import { useState, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Plus, Check, Search, Loader2 } from "lucide-react";
import { Input, } from "@/components/ui/input";
import type { SkillRead } from "@/types/skill";
import { cn } from "@/lib/utils";
import {
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { useSkill } from "@/hooks/queries/admin/useSkill";
import { Button } from "@/components/ui/button";
import CreateSkillModal from "@/components/modal/CreateSkillModal";

interface QuestionsBankSkillSelectorProps {
  initialSelectedSkills?: SkillRead[];
  placeholderMessage?: string;
}

const EMPTY_ARRAY: SkillRead[] = [];

export function QuestionsBankSkillSelector({
  initialSelectedSkills = EMPTY_ARRAY,
  placeholderMessage = "Select stacks/skills to link to this question paper template."
}: QuestionsBankSkillSelectorProps) {
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
  const { data: skills, loading: isLoading, refetch: refetchSkills } = useSkill({ skip: 0, limit: 100, q: debouncedSearch });

  const allSkills = useMemo(() => {
    const uniqueMap = new Map<string, SkillRead>();
    initialSelectedSkills.forEach((s) => uniqueMap.set(s.id, s));
    skills.forEach((s) => uniqueMap.set(s.id, s));
    return Array.from(uniqueMap.values());
  }, [skills, initialSelectedSkills]);

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

  const filteredSkills = useMemo(() => {
    let result = skills || [];
    if (skillSearch.trim()) {
      const query = skillSearch.toLowerCase();
      result = allSkills.filter((skill) =>
        skill.name.toLowerCase().includes(query) || (skill.description && skill.description.toLowerCase().includes(query))
      );
    }

    // Sort: selected skills first
    return [...result].sort((a, b) => {
      const aSelected = selectedSkillIds.includes(a.id);
      const bSelected = selectedSkillIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  }, [skills, allSkills, skillSearch, selectedSkillIds]);

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSkill(null);
  };

  return (
    <div className="space-y-0.5 pt-0.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <p className="text-xs text-muted-foreground font-medium">
          {placeholderMessage}
        </p>
        <Button
          onClick={() => setShowModal(true)}
          variant="outline"
          size="sm"
          type="button"
          className="h-8 rounded-xl text-xs font-semibold shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Create Skill
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

      {/* Skill Search */}
      <div className="relative p-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search skill stack..."
          value={skillSearch}
          onChange={(e) => setSkillSearch(e.target.value)}
          className="pl-9 h-9 text-xs rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 max-h-52 overflow-y-auto p-0.5 custom-scrollbar">
        {filteredSkills.length > 0 ? (
          filteredSkills.map((skill) => {
            const isSelected = selectedSkillIds.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                className={cn(
                  "flex items-center justify-between px-2 py-1 rounded-xl border-2 transition-all duration-200 text-left group",
                  isSelected
                    ? "bg-primary/10 border-primary text-primary shadow-sm"
                    : "bg-background border-muted-foreground/10 text-muted-foreground hover:border-primary/45 hover:bg-primary/5",
                )}
              >
                <span className="font-semibold text-[11px] lg:text-xs mr-1.5 whitespace-normal leading-tight">
                  {skill.name}
                </span>

                <div
                  className={cn(
                    "shrink-0 w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-200",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground scale-105"
                      : "border-muted-foreground/20 group-hover:border-primary/40",
                  )}
                >
                  {isSelected ? (
                    <Check className="h-2.5 w-2.5 stroke-[3px]" />
                  ) : (
                    <Plus className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="col-span-full py-5 text-center bg-muted/10 rounded-xl border border-dashed border-muted-foreground/10">
            <p className="text-muted-foreground text-xs italic font-medium">
              {initialSelectedSkills.length === 0
                ? "No skills found."
                : "No matching skills."}
            </p>
          </div>
        )}
      </div>

      <CreateSkillModal
        show={showModal}
        handleClose={handleCloseModal}
        onSkillSaved={refetchSkills}
        skill={selectedSkill}
      />
    </div>
  );
}
