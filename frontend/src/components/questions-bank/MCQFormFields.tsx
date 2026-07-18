import { useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Required } from "@/components/shared/Required";
import { useEffect } from "react";
import { toast } from "sonner";
import { QuestionMetricsInput } from "./QuestionMetricsInput";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface MCQFormFieldsProps {
  disabled?: boolean;
}

export function MCQFormFields({ disabled = false }: MCQFormFieldsProps) {
  const { control, setValue, getValues } = useFormContext();

  const options: string[] = useWatch({
    control,
    name: "options",
    defaultValue: ["", ""],
  });

  useEffect(() => {
    if (options.length >= 26) {
      toast.warning("Maximum 26 options are allowed");
    }
  }, [options.length]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* MCQ Question Text */}
      <FormField
        control={control}
        name="question"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel className="text-sm font-semibold">
              MCQ Question Text <Required />
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter the MCQ question..."
                disabled={disabled}
                className="min-h-20"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* MCQ Options */}
      <div className="space-y-1">
        <Label className="text-sm font-semibold">MCQ Options</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {options.map((_, idx) => {
            const optionKey = `options.${idx}`;
            const isRequired = idx < 2;
            return (
              <FormField
                key={idx}
                control={control}
                name={optionKey}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-semibold">
                        Option {String.fromCharCode(65 + idx)} {isRequired ? <Required /> : "(Optional)"}
                      </FormLabel>
                      {!isRequired && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const nextOptions = [...options];
                            nextOptions.splice(idx, 1);
                            setValue("options", nextOptions, { shouldValidate: true, shouldDirty: true });

                            // Adjust answer if the deleted option was selected or affects the index
                            const currentAnswer = getValues("answer") || "";
                            const answerIndex = currentAnswer.charCodeAt(0) - 65;
                            if (answerIndex === idx) {
                              setValue("answer", "A", { shouldValidate: true, shouldDirty: true });
                            } else if (answerIndex > idx) {
                              setValue("answer", String.fromCharCode(65 + answerIndex - 1), { shouldValidate: true, shouldDirty: true });
                            }
                          }}
                          className="text-xs font-semibold text-destructive inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={`Enter option ${String.fromCharCode(65 + idx)}`}
                        disabled={disabled}
                        // className="text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          })}
        </div>

        <div className="flex justify-start pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue("options", [...options, ""], { shouldValidate: true, shouldDirty: true });
            }}
            className="text-xs font-semibold flex items-center gap-1.5 bg-background hover:bg-muted"
            disabled={disabled || options.length >= 26 || options.some((opt) => !opt.trim())}
          >
            <Plus className="h-4 w-4" /> Add Option
          </Button>
        </div>
      </div>

      {/* Correct Answer Selector & Metrics */}
      <div className="flex flex-wrap gap-4 items-start">
        <FormField
          control={control}
          name="answer"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1.5 min-w-50">
              <FormLabel className="text-sm font-semibold">Correct Answer Option</FormLabel>
              <FormControl>
                <SearchableSelect
                  value={field.value}
                  onValueChange={(val) => field.onChange(val || "")}
                  options={options
                    .map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      return {
                        id: letter,
                        label: `Option {letter}{opt.trim() ? \`: \${opt}\` : ""}`,
                        text: opt,
                      };
                    })
                    .filter((item) => item.text.trim().length > 0)
                    .map((item) => ({
                      id: item.id,
                      label: `Option ${item.id}${item.text.trim() ? `: ${item.text}` : ""}`,
                    }))
                  }
                  placeholder="Select correct option"
                  searchPlaceholder="Search option..."
                  disabled={disabled}
                  triggerClassName="h-10 text-sm rounded-4xl"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Marks & Duration Section */}
        <QuestionMetricsInput
          control={control}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
