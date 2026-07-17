import { useFormContext } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { QuestionMetricsInput } from "./QuestionMetricsInput";
import { Required } from "@/components/shared/Required";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface SingleQuestionFormFieldsProps {
  disabled?: boolean;
}

export function SingleQuestionFormFields({ disabled = false }: SingleQuestionFormFieldsProps) {
  const { control } = useFormContext();

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Question Text */}
      <FormField
        control={control}
        name="question"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel className="text-sm font-semibold">
              Question Text <Required />
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter the question text..."
                disabled={disabled}
                className="min-h-[100px] text-sm bg-background w-full"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Marks & Duration Section */}
      <QuestionMetricsInput control={control} disabled={disabled} />
    </div>
  );
}
