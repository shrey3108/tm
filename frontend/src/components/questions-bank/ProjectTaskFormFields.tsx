import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubTasksFormSection } from "./SubTasksFormSection";
import { Required } from "@/components/shared/Required";
import { QuestionMetricsInput } from "./QuestionMetricsInput";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface ProjectTaskFormFieldsProps {
  disabled?: boolean;
}

export function ProjectTaskFormFields({ disabled = false }: ProjectTaskFormFieldsProps) {
  const { control } = useFormContext();
  // console.log(control._formState.errors)
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Description Field */}
      <FormField
        control={control}
        name="project_task"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel className="text-sm font-semibold">
              Project Task Description<Required />
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter the project task description"
                disabled={disabled}
                className="min-h-20"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Instructions Field */}
      <FormField
        control={control}
        name="instructions"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel className="text-sm font-semibold">
              Instructions<Required />
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter detailed instructions for candidates..."
                disabled={disabled}
                className="min-h-16"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Overall Duration Field */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Overall Project Duration<Required /></Label>
        <QuestionMetricsInput control={control} disabled={disabled} contentType="project_task" />
      </div>

      {/* Reusable Sub-tasks Section */}
      <FormField
        control={control}
        name="tasks"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1">
            <FormControl>
              <SubTasksFormSection
                tasks={field.value || []}
                onTasksChange={(updatedTasks) => field.onChange(updatedTasks)}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
