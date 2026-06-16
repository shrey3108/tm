import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Save, FileQuestion, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { useCreateQuestionSetPaperMutation } from "@/hooks/mutations/taskPapers/useTaskPaperMutations";
import type { QuestionSetPaperRead } from "@/types/taskPaper";
import { extractErrorMessage } from "@/utils/error";
import { manualQuestionPaperSchema, type ManualQuestionPaperFormValues } from "@/schemas/taskPaper";
import { Required } from "@/components/job-form/Required";

interface ManualPaperCreateFormProps {
  jobId: string;
  positionId: string;
  onSuccess?: (newPaper: QuestionSetPaperRead) => void;
  onCancel?: () => void;
}

export function ManualPaperCreateForm({
  jobId,
  positionId,
  onSuccess,
  onCancel,
}: ManualPaperCreateFormProps) {
  const createPaperMutation = useCreateQuestionSetPaperMutation();

  const form = useForm<ManualQuestionPaperFormValues>({
    resolver: zodResolver(manualQuestionPaperSchema),
    defaultValues: {
      // name: "",
      questions: [{ value: "" }],
      project_tasks: [{ value: "" }],
    },
  });

  const { control, handleSubmit, } = form;

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control,
    name: "questions",
  });

  const { fields: projectTaskFields, append: appendProjectTask, remove: removeProjectTask } = useFieldArray({
    control,
    name: "project_tasks",
  });

  const onSubmit = async (values: ManualQuestionPaperFormValues) => {
    if (!jobId || !positionId) {
      toast.error("Job ID and Position ID are required.");
      return;
    }

    try {
      const filteredProjectTasks = values.project_tasks
        ? values.project_tasks.map((t) => t.value.trim()).filter(Boolean)
        : [];

      const payload = {
        // name: values.name.trim(),
        job_id: jobId,
        position_id: positionId,
        questions: values.questions.map((q) => q.value.trim()),
        project_task: filteredProjectTasks.length > 0 ? filteredProjectTasks : undefined,
      };

      const result = await createPaperMutation.mutateAsync(payload);
      toast.success("Successfully defined question set paper! AI skill extraction is processing in the background.");
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Failed to create question set paper."));
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-3 p-3 rounded-2xl border border-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-300 mx-auto"
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              Define Question Paper
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Create Question bank by entering questions & tasks directly
          </p>
        </div>

        {/* Name Input */}
        {/*<FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-foreground">
                Paper Template Name <Required />
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Technical Interview"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />*/}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Questions Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileQuestion className="h-4 w-4 text-primary" />
                Questions <Required />
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendQuestion({ value: "" })}
                className="h-8 rounded-lg text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-all border-dashed"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Question
              </Button>
            </div>

            <ul className="list-decimal pl-5 space-y-2 overflow-y-auto pr-1 w-full">
              {questionFields.map((field, idx) => (
                <li key={field.id} className="group w-full my-1">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <FormField
                      control={control}
                      name={`questions.${idx}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1 space-y-1 w-full">
                          <FormControl className="w-full">
                            <Textarea
                              placeholder={`Question ${idx + 1}`}
                              className="min-h-[60px] resize-y"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (questionFields.length === 1) {
                          form.setValue("questions", [{ value: "" }]);
                        } else {
                          removeQuestion(idx);
                        }
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg shrink-0 mt-1.5 transition-colors"
                      title="Remove Question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Project Tasks Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Project Tasks (Optional)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendProjectTask({ value: "" })}
                className="h-8 rounded-lg text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-all border-dashed"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Task
              </Button>
            </div>

            <ul className="list-decimal pl-5 space-y-2 overflow-y-auto pr-1 w-full">
              {projectTaskFields.map((field, idx) => (
                <li key={field.id} className="group w-full my-0.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <FormField
                      control={control}
                      name={`project_tasks.${idx}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1 space-y-1 w-full">
                          <FormControl className="w-full">
                            <Textarea
                              placeholder={`Task description ${idx + 1}`}
                              className="min-h-[60px] resize-y"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (projectTaskFields.length === 1) {
                          form.setValue("project_tasks", [{ value: "" }]);
                        } else {
                          removeProjectTask(idx);
                        }
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg shrink-0 mt-1.5 transition-colors"
                      title="Remove Task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={createPaperMutation.isPending}
              className="rounded-xl font-semibold px-5 h-10"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={createPaperMutation.isPending}
            className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md hover:shadow-lg transition-all px-6 h-10"
          >
            {createPaperMutation.isPending ? (
              "Creating..."
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create & Save Paper
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
