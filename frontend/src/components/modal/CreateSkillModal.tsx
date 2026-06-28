/**
 * Modal for creating or updating a skill.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback } from "react";
import type { SkillRead } from "@/types/skill";
import { useCreateSkillMutation, useUpdateSkillMutation } from "@/hooks/mutations/admin/useSkill";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
import { skillCreateSchema, type SkillCreateFormValues } from "@/schemas/skill";
import ErrorDisplay from "@/components/shared/ErrorDisplay";
import { Textarea } from "@/components/ui/textarea";

interface CreateSkillModalProps {
  show: boolean;
  handleClose: () => void;
  onSkillSaved: () => void;
  skill: SkillRead | null;
}

const DEFAULT_SKILL_VALUES: SkillCreateFormValues = {
  name: "",
  description: "",
  default_weightage: 10,
};

const CreateSkillModal = ({ show, handleClose, onSkillSaved, skill }: CreateSkillModalProps) => {
  const isEditMode = !!skill;
  const createSkillMutation = useCreateSkillMutation();
  const updateSkillMutation = useUpdateSkillMutation();

  const mapItemToValues = useCallback(
    (s: SkillRead): SkillCreateFormValues => ({
      name: s.name,
      description: s.description || "",
      default_weightage: s.default_weightage ?? 10,
    }),
    [],
  );

  const onSubmit = async (data: SkillCreateFormValues) => {
    if (isEditMode && skill) {
      await updateSkillMutation.mutateAsync({ id: skill.id, data });
    } else {
      await createSkillMutation.mutateAsync(data);
    }
    onSkillSaved();
    handleClose();
  };

  const formModal = useFormModal<SkillCreateFormValues, SkillRead>({
    schema: skillCreateSchema,
    defaultValues: DEFAULT_SKILL_VALUES,
    item: skill,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Skill" : "Create New Skill"}</DialogTitle>
        </DialogHeader>

        {submitError && <ErrorDisplay message={submitError} />}

        <Form {...formModal}>
          <form id="create-skill-form" onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skill Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. React.js" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Briefly describe the skill..." rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="default_weightage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Weightage</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="any" placeholder="e.g. 10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleFormSubmit} disabled={isSubmitting}>
            {isEditMode ? "Update Skill" : "Create Skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSkillModal;
