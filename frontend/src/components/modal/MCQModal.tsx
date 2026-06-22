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
import type { MCQItem } from "@/types/taskPaper";
import { mcqSchema, type MCQFormValues } from "@/schemas/taskPaper";

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
    resolver: zodResolver(mcqSchema),
    defaultValues: {
      question: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      answer: "A",
    },
  });

  const { handleSubmit, control, reset } = form;
  const optionCValue = form.watch("optionC");
  const optionDValue = form.watch("optionD");

  useEffect(() => {
    if (show) {
      if (initialValue) {
        // Find which option letter matches the answer text
        const { question, options, answer } = initialValue;
        const optionA = options[0] || "";
        const optionB = options[1] || "";
        const optionC = options[2] || "";
        const optionD = options[3] || "";

        let answerLetter: "A" | "B" | "C" | "D" = "A";
        if (answer === optionB) answerLetter = "B";
        else if (answer === optionC) answerLetter = "C";
        else if (answer === optionD) answerLetter = "D";

        reset({
          question,
          optionA,
          optionB,
          optionC,
          optionD,
          answer: answerLetter,
        });
      } else {
        reset({
          question: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          answer: "A",
        });
      }
    }
  }, [show, initialValue, reset]);

  const onSubmit = async (data: MCQFormValues) => {
    let answerText = data.optionA;
    if (data.answer === "B") answerText = data.optionB;
    else if (data.answer === "C") answerText = data.optionC;
    else if (data.answer === "D") answerText = data.optionD;

    const optionsList = [
      data.optionA.trim(),
      data.optionB.trim(),
      data.optionC.trim(),
      data.optionD.trim(),
    ].filter(Boolean);

    const mcqItem: MCQItem = {
      question: data.question.trim(),
      options: optionsList,
      answer: answerText.trim(),
    };

    await onSave(mcqItem);
    handleClose();
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && !isSaving && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit MCQ" : "Add New MCQ"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MCQ Question Text</FormLabel>
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

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={control}
                name="optionA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option A</FormLabel>
                    <FormControl>
                      <Input placeholder="Option A text" disabled={isSaving} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="optionB"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option B</FormLabel>
                    <FormControl>
                      <Input placeholder="Option B text" disabled={isSaving} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="optionC"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option C (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Option C text" disabled={isSaving} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="optionD"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option D (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Option D text" disabled={isSaving} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={control}
              name="answer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correct Answer Option</FormLabel>
                  <Select
                    disabled={isSaving}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select correct option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="A">Option A</SelectItem>
                      <SelectItem value="B">Option B</SelectItem>
                      <SelectItem value="C" disabled={!optionCValue?.trim()}>
                        Option C {!optionCValue?.trim() && "(Disabled - Fill Option C)"}
                      </SelectItem>
                      <SelectItem value="D" disabled={!optionDValue?.trim()}>
                        Option D {!optionDValue?.trim() && "(Disabled - Fill Option D)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
