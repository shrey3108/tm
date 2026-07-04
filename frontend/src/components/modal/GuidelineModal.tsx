/**
 * Modal for creating or updating a guideline.
 * Uses Zod for form validation and shadcn components.
 */

import { useCallback } from "react";
import type { GuidelineRead } from "@/types/guideline";
import { useCreateGuidelineMutation, useUpdateGuidelineMutation } from "@/hooks/mutations/admin/useGuideline";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFormModal } from "@/hooks/useFormModal";
import { guidelineCreateSchema, type GuidelineCreateFormValues } from "@/schemas/guideline";
import ErrorDisplay from "@/components/shared/ErrorDisplay";

interface CreateGuidelineModalProps {
  show: boolean;
  handleClose: () => void;
  onGuidelineSaved: () => void;
  guideline: GuidelineRead | null;
}

const DEFAULT_GUIDELINE_VALUES: GuidelineCreateFormValues = {
  content: "",
  is_default: false,
};

const CreateGuidelineModal = ({
  show,
  handleClose,
  onGuidelineSaved,
  guideline,
}: CreateGuidelineModalProps) => {
  const isEditMode = !!guideline;
  const createGuidelineMutation = useCreateGuidelineMutation();
  const updateGuidelineMutation = useUpdateGuidelineMutation();

  const mapItemToValues = useCallback(
    (g: GuidelineRead): GuidelineCreateFormValues => ({
      content: g.content,
      is_default: g.is_default,
    }),
    [],
  );

  const onSubmit = async (data: GuidelineCreateFormValues) => {
    if (isEditMode && guideline) {
      await updateGuidelineMutation.mutateAsync({ id: guideline.id, data });
    } else {
      await createGuidelineMutation.mutateAsync(data);
    }
    onGuidelineSaved();
    handleClose();
  };

  const formModal = useFormModal<GuidelineCreateFormValues, GuidelineRead>({
    schema: guidelineCreateSchema,
    defaultValues: DEFAULT_GUIDELINE_VALUES,
    item: guideline,
    show,
    mapItemToValues,
    onSubmit,
  });

  const { handleFormSubmit, isSubmitting, submitError, control } = formModal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader className="mb-4">
          <DialogTitle>{isEditMode ? "Edit Term & Condition" : "Create New Term & Condition"}</DialogTitle>
        </DialogHeader>

        {submitError && (
          <div className="mb-4">
            <ErrorDisplay message={submitError} />
          </div>
        )}

        <Form {...formModal}>
          <form id="create-guideline-form" onSubmit={handleFormSubmit} className="space-y-4">
            <FormField
              control={control}
              name="content"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Term & Condition Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter terms & conditions instructions here..."
                      rows={8}
                      {...field}
                      value={field.value || ""}
                      onFocus={(e) => {
                        const len = e.target.value.length;
                        e.target.setSelectionRange(len, len, "forward");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={handleClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-guideline-form" isLoading={isSubmitting}>
            {isEditMode ? "Update Term & Condition" : "Create Term & Condition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGuidelineModal;
