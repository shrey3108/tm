/**
 * @module AssociateReviewPage
 * @component AssociateReviewPage
 *
 * Public page component allowing associates to view, evaluate, and submit candidate feedback.
 */
import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2, Award, ClipboardCheck, ArrowRight, BookOpen } from "lucide-react";

import AppPageShell from "@/components/shared/AppPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Dummy data as specified
const candidateDetails = {
  candidateName: "Alpesh Trivedi",
  jobName: "Dev Job",
  positionName: "Frontend Developer",
  department: "Frontend",
  positionLevel: "Intern",
};

const dummyQuestions = [
  {
    id: "q1",
    question: "Write a custom React hook that manages a debounced value state.",
    maxMarks: 10,
  },
  {
    id: "q2",
    question: "Explain the difference between Virtual DOM and Shadow DOM, and how they relate to performance.",
    maxMarks: 5,
  },
  {
    id: "q3",
    question: "Create a responsive layout utilizing CSS Grid where items reposition from 4 columns to 1 column on mobile screens.",
    maxMarks: 10,
  },
];

// Dynamically construct Zod schema based on questions' max marks
const createReviewSchema = (questions: typeof dummyQuestions) => {
  const shape: Record<string, any> = {};
  questions.forEach((q) => {
    shape[q.id] = z
      .preprocess(
        (val) => (val === "" || val === undefined ? undefined : Number(val)),
        z
          .number({ error: "Must be a valid number" })
          .min(0, "Marks cannot be negative")
          .max(q.maxMarks, `Cannot exceed max marks of ${q.maxMarks}`)
      );
  });
  return z.object(shape);
};

export default function AssociateReviewPage() {
  const [submittedData, setSubmittedData] = useState<Record<string, number> | null>(null);

  const reviewSchema = useMemo(() => createReviewSchema(dummyQuestions), []);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<Record<string, number>>({
    resolver: zodResolver(reviewSchema) as any,
    defaultValues: dummyQuestions.reduce((acc, q) => ({ ...acc, [q.id]: "" }), {}),
    mode: "onChange",
  });

  const onSubmit = async (data: Record<string, number>) => {
    // Simulate submit delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSubmittedData(data);
  };

  const totalMaxMarks = dummyQuestions.reduce((sum, q) => sum + q.maxMarks, 0);

  const totalAwardedMarks = useMemo(() => {
    if (!submittedData) return 0;
    return Object.values(submittedData).reduce((sum, val) => sum + (val || 0), 0);
  }, [submittedData]);

  if (submittedData) {
    return (
      <AppPageShell width="wide" className="p-4 flex items-center justify-center min-h-[80vh] bg-background">
        <div className="w-full max-w-md bg-card border border-border/40 rounded-2xl p-4 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300 space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Thank You!</h1>
            <p className="text-sm text-muted-foreground">Your candidate evaluation has been submitted successfully.</p>
          </div>

          <div className="bg-muted/30 border border-border/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Candidate</span>
              <span className="text-sm font-semibold text-foreground">{candidateDetails.candidateName}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/20 pt-2">
              <span className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-primary" /> Total Score
              </span>
              <span className="text-sm font-bold text-foreground">
                {totalAwardedMarks} / {totalMaxMarks}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">You may now close this browser window.</p>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide" className="p-4 bg-background">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header Block */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Associate Evaluation Form
          </div>
          <h1 className="text-xl font-extrabold text-foreground">
            Evaluate submission for {candidateDetails.candidateName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Review the questions below and award marks based on the candidate's performance.
          </p>
        </div>

        {/* Details Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Job Name</span>
            <span className="text-sm font-semibold truncate mt-0.5 text-foreground">{candidateDetails.jobName}</span>
          </div>
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Candidate Name</span>
            <span className="text-sm font-semibold truncate mt-0.5 text-foreground">{candidateDetails.candidateName}</span>
          </div>
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Position Name</span>
            <span className="text-sm font-semibold truncate mt-0.5 text-foreground">{candidateDetails.positionName}</span>
          </div>
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Department</span>
            <span className="text-sm font-semibold truncate mt-0.5 text-foreground">{candidateDetails.department}</span>
          </div>
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Position Level</span>
            <span className="text-sm font-semibold truncate mt-0.5 text-foreground">{candidateDetails.positionLevel}</span>
          </div>
        </div>

        {/* Evaluation Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card/40 border border-border/40 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Question</h2>
          </div>

          <div className="space-y-3">
            {dummyQuestions.map((q, idx) => (
              <div key={q.id} className="p-3 bg-muted/10 border border-border/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-muted/20">
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-primary">Question {idx + 1}</span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{q.question}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-background/50 border border-border/40 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mr-2">Max Marks</span>
                    <span className="text-xs font-black text-foreground">{q.maxMarks}</span>
                  </div>

                  <div className="flex flex-col">
                    <Controller
                      control={control}
                      name={q.id}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="number"
                          step="0.5"
                          min="0"
                          max={q.maxMarks}
                          placeholder="Score"
                          className="w-20 text-center rounded-xl h-8 bg-background border-border/50 text-xs font-bold"
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form Validation Errors Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <span className="text-xs font-bold text-destructive">Please fix the following validation errors:</span>
              <ul className="list-disc pl-4 mt-1 text-[11px] text-destructive/90 font-medium space-y-0.5">
                {Object.keys(errors).map((key) => {
                  const qIdx = dummyQuestions.findIndex((q) => q.id === key);
                  return (
                    <li key={key}>
                      Question {qIdx + 1}: {errors[key]?.message}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-10 rounded-xl font-bold gap-2 text-sm transition-all shadow-sm"
            disabled={!isValid || isSubmitting}
          >
            Submit Evaluation
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </AppPageShell>
  );
}
