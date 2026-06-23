import { useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Form } from "@/components/ui/form";
import { SkillSelectorSection } from "@/components/job-form/SkillSelectorSection";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { useUpdateQuestionSetPaperSkillsMutation } from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import { extractErrorMessage } from "@/utils/error";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  refetchPapers: () => void;
}

export function QuestionsBankSkills({
  firstPaper,
  refetchPapers,
}: QuestionsBankSkillsProps) {
  const updateSkillsMutation = useUpdateQuestionSetPaperSkillsMutation();

  const firstPaperSkills = useMemo(() => firstPaper?.skills || [], [firstPaper]);
  const firstPaperSkillIds = useMemo(() => firstPaperSkills.map((s) => s.id), [firstPaperSkills]);

  const form = useForm({
    defaultValues: {
      skill_ids: firstPaperSkillIds,
    },
  });

  useEffect(() => {
    form.reset({
      skill_ids: firstPaperSkillIds,
    });
  }, [firstPaperSkillIds, form]);

  const watchedSkillIds = form.watch("skill_ids");
  const lastSavedSkillsRef = useRef<string[]>(firstPaperSkillIds);

  useEffect(() => {
    lastSavedSkillsRef.current = firstPaperSkillIds;
  }, [firstPaperSkillIds]);

  useEffect(() => {
    if (!firstPaper?.id || !watchedSkillIds) return;

    // Check if watched matches last saved
    const isDifferent =
      watchedSkillIds.length !== lastSavedSkillsRef.current.length ||
      watchedSkillIds.some((id) => !lastSavedSkillsRef.current.includes(id));

    if (isDifferent) {
      const saveSkills = async () => {
        try {
          await updateSkillsMutation.mutateAsync({
            paperId: firstPaper.id,
            skillIds: watchedSkillIds,
          });
          lastSavedSkillsRef.current = watchedSkillIds;
          toast.success("Skills updated successfully.");
          refetchPapers();
        } catch (err: unknown) {
          toast.error(extractErrorMessage(err, "Failed to update skills."));
        }
      };
      saveSkills();
    }
  }, [watchedSkillIds, firstPaper?.id, updateSkillsMutation, refetchPapers]);

  return (
    <div className="mt-2">
      <Accordion className="border border-border bg-card rounded-xl">
        <AccordionItem value="skills" className="border-none">
          <AccordionTrigger className="hover:no-underline p-2">
            <div className="flex flex-col items-start gap-1">
              <h3 className="text-sm font-bold tracking-tight text-foreground">Linked Tech Stack Skills</h3>
              <p className="text-xs text-muted-foreground font-medium">
                Manage the skills extracted or manually linked to this question template set.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0">
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap gap-1.5 items-center">
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
                  <span className="text-xs text-muted-foreground italic">No skills linked yet. Use the selector below to link skills.</span>
                )}
              </div>

              <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                <div className="pt-1 border-t border-border/40 w-full">
                  <Form {...form}>
                    <SkillSelectorSection
                      initialSelectedSkills={firstPaperSkills}
                      placeholderMessage="Select the skills to link to this question paper template."
                    />
                  </Form>
                </div>
              </PermissionGuard>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
