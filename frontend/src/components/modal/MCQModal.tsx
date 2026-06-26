import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import type { MCQItem } from "@/types/taskPaper";
import { mcqFormSchema, type MCQFormValues } from "@/schemas/taskPaper";
import { Required } from "@/components/job-form/Required";

interface MCQModalProps {
  show: boolean;
  handleClose: () => void;
  onSave: (mcq: MCQItem) => Promise<void> | void;
  initialValue?: MCQItem | null;
  isSaving?: boolean;
}

export default function MCQModal({
  show,
  handleClose,
  onSave,
  initialValue = null,
  isSaving = false,
}: MCQModalProps) {
  const isEditMode = !!initialValue;

  const form = useForm<MCQFormValues>({
    resolver: zodResolver(mcqFormSchema) as any,
    defaultValues: {
      question: "",
      options: ["", ""],
      answer: "A",
      marks: "",
      hours: 0,
      minutes: 5,
    },
  });

  const { handleSubmit, control, reset } = form;
  const options = form.watch("options") || ["", ""];

  useEffect(() => {
    if (show) {
      if (initialValue) {
        // Find which option letter matches the answer text
        const { question, options: rawOptions, answer, marks, duration } = initialValue;
        const answerIndex = rawOptions.indexOf(answer);
        const answerLetter = answerIndex !== -1 ? String.fromCharCode(65 + answerIndex) : "A";

        reset({
          question,
          options: rawOptions.length >= 2 ? rawOptions : [...rawOptions, ...Array(2 - rawOptions.length).fill("")],
          answer: answerLetter,
          marks: marks || "",
          hours: duration ? Math.floor(duration / 60) : 0,
          minutes: duration ? duration % 60 : 5,
        });
      } else {
        reset({
          question: "",
          options: ["", ""],
          answer: "A",
          marks: "",
          hours: 0,
          minutes: 5,
        });
      }
    }
  }, [show, initialValue, reset]);

  const onSubmit = async (data: MCQFormValues) => {
    const answerIndex = data.answer.charCodeAt(0) - 65;
    const answerText = data.options[answerIndex] || "";

    const hours = typeof data.hours === "number" ? data.hours : 0;
    const minutes = typeof data.minutes === "number" ? data.minutes : 0;
    const duration = hours * 60 + minutes;

    const mcqItem: MCQItem = {
      question: data.question.trim(),
      options: data.options.map((opt) => opt.trim()),
      answer: answerText.trim(),
      marks: typeof data.marks === "number" ? data.marks : 0,
      duration,
    };

    await onSave(mcqItem);
    handleClose();
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && !isSaving && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit MCQ" : "Add New MCQ"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* MCQ Question Text */}
            <FormField
              control={control as any}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">MCQ Question Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the MCQ question text ..."
                      rows={3}
                      disabled={isSaving}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* MCQ Options */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-semibold">MCQ Options</FormLabel>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    form.setValue("options", [...options, ""]);
                  }}
                  disabled={isSaving || options.length >= 26 || options.some((opt) => !opt.trim())}
                  className="h-8 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add Option
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {options.map((_, index) => {
                  const isRequired = index < 2;
                  return (
                    <FormField
                      key={index}
                      control={control as any}
                      name={`options.${index}`}
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-xs font-semibold text-muted-foreground">
                              Option {String.fromCharCode(65 + index)} {isRequired ? <Required /> : "(Optional)"}
                            </FormLabel>
                            {!isRequired && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOptions = [...options];
                                  newOptions.splice(index, 1);
                                  form.setValue("options", newOptions, { shouldValidate: true });

                                  // Adjust selected answer
                                  const answerVal = form.getValues("answer");
                                  const answerIndex = answerVal.charCodeAt(0) - 65;
                                  if (answerIndex === index) {
                                    form.setValue("answer", "A", { shouldValidate: true });
                                  } else if (answerIndex > index) {
                                    form.setValue("answer", String.fromCharCode(65 + answerIndex - 1), { shouldValidate: true });
                                  }
                                }}
                                disabled={isSaving}
                                className="text-xs font-semibold text-destructive hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <FormControl>
                            <Input
                              placeholder={`Option ${String.fromCharCode(65 + index)} text`}
                              disabled={isSaving}
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
            </div>

            {/* Correct Answer selector */}
            <FormField
              control={control}
              name="answer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Correct Answer Option</FormLabel>
                  <Select
                    disabled={isSaving}
                    onValueChange={field.onChange}
                    value={field.value}
                    modal={false}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      {options.map((opt, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isEmpty = !opt?.trim();
                        return (
                          <SelectItem key={idx} value={letter} disabled={isEmpty}>
                            Option {letter} {isEmpty && `(Disabled - Fill Option ${letter})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Marks & Duration Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl border border-border bg-muted/20">
              {/* Marks */}
              <FormField
                control={control as any}
                name="marks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Marks</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10"
                        disabled={isSaving}
                        min={1}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                  </FormItem>
                )}
              />

              {/* Hours */}
              <FormField
                control={control as any}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        disabled={isSaving}
                        min={0}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                  </FormItem>
                )}
              />

              {/* Minutes */}
              <FormField
                control={control as any}
                name="minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Minutes</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="30"
                        disabled={isSaving}
                        min={0}
                        max={59}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200" />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-4 pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                type="button"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
              >
                {isEditMode ? "Update MCQ" : "Add MCQ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
