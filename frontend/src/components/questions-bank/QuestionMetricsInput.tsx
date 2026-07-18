import { useFormContext, useFormState, type Control, type FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Required } from "@/components/shared/Required";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import type { QuestionType } from "@/pages/dashboard/AssignPaperPage";

interface QuestionMetricsInputProps {
  control?: Control<FieldValues, any, FieldValues>;
  marksName?: string;
  hoursName?: string;
  minutesName?: string;
  marksPlaceholder?: string;
  hoursPlaceholder?: string;
  minutesPlaceholder?: string;
  disabled?: boolean;
  contentType?: QuestionType;
}

export function QuestionMetricsInput({
  control: propControl,
  marksName = "marks",
  hoursName = "hours",
  minutesName = "minutes",
  marksPlaceholder = "00",
  hoursPlaceholder = "00",
  minutesPlaceholder = "00",
  disabled = false,
  contentType
}: QuestionMetricsInputProps) {
  const context = useFormContext();
  const control = propControl || context?.control;
  const { errors } = useFormState({ control });

  const marksError = errors[marksName]?.message as string | undefined;
  const hoursError = errors[hoursName]?.message as string | undefined;
  const minutesError = errors[minutesName]?.message as string | undefined;

  const hasErrors = marksError || hoursError || minutesError;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-start gap-4">
        {/* Marks */}
        {contentType !== "project_task" ? <FormField
          control={control}
          name={marksName}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1 w-20">
              <FormLabel className="text-xs font-semibold">
                Marks<Required />
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder={marksPlaceholder}
                  min={1}
                  disabled={disabled}
                  className="w-20"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    field.onChange(val);
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        /> : null}

        {/* Hours */}
        <FormField
          control={control}
          name={hoursName}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1 w-20">
              <FormLabel className="text-xs font-semibold">
                Hours<Required />
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder={hoursPlaceholder}
                  min={0}
                  disabled={disabled}
                  className="w-20"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    field.onChange(val);
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Minutes */}
        <FormField
          control={control}
          name={minutesName}
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1 w-20">
              <FormLabel className="text-xs font-semibold">
                Minutes<Required />
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder={minutesPlaceholder}
                  min={0}
                  max={59}
                  disabled={disabled}
                  className="w-20"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    field.onChange(val);
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {hasErrors && (
        <div className="flex flex-col text-xs font-medium text-destructive mt-1">
          {marksError && <FormMessage >{marksError}</FormMessage>}
          {hoursError && <FormMessage>{hoursError}</FormMessage>}
          {minutesError && <FormMessage>{minutesError}</FormMessage>}
        </div>
      )}
    </div>
  );
}

