import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuestionSetPaperRead, MCQItem } from "@/types/taskPaper";
import { CheckCircle2, AlertTriangle, HelpCircle, PenLine, Plus, Trash2, Pencil, X, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
interface CustomPaperFormProps {
  predefinedPapers: QuestionSetPaperRead[];
  customQuestions: string[];
  onCustomQuestionsChange: (questions: string[]) => void;
  customProjectTask: string;
  onCustomProjectTaskChange: (value: string) => void;
  customQuestionText: string;
  onCustomQuestionTextChange: (value: string) => void;
  customProjectTaskText: string;
  onCustomProjectTaskTextChange: (value: string) => void;
  customMcqs: MCQItem[];
  onCustomMcqsChange: (mcqs: MCQItem[]) => void;
}

export function CustomPaperForm({
  predefinedPapers,
  customQuestions,
  onCustomQuestionsChange,
  customProjectTask,
  onCustomProjectTaskChange,
  customQuestionText,
  onCustomQuestionTextChange,
  customProjectTaskText,
  onCustomProjectTaskTextChange,
  customMcqs,
  onCustomMcqsChange,
}: CustomPaperFormProps) {
  const totalUniqueQuestionsCount = new Set(
    predefinedPapers.flatMap((p) => p.questions || [])
  ).size;

  // MCQ inline form state
  const [showMcqForm, setShowMcqForm] = useState(false);
  const [editingMcqIndex, setEditingMcqIndex] = useState<number | null>(null);
  const [mcqQuestion, setMcqQuestion] = useState("");
  const [mcqOptionA, setMcqOptionA] = useState("");
  const [mcqOptionB, setMcqOptionB] = useState("");
  const [mcqOptionC, setMcqOptionC] = useState("");
  const [mcqOptionD, setMcqOptionD] = useState("");
  const [mcqAnswer, setMcqAnswer] = useState<string>("A");

  const resetMcqForm = () => {
    setMcqQuestion("");
    setMcqOptionA("");
    setMcqOptionB("");
    setMcqOptionC("");
    setMcqOptionD("");
    setMcqAnswer("A");
    setEditingMcqIndex(null);
  };

  const handleSaveMcq = () => {
    if (!mcqQuestion.trim() || !mcqOptionA.trim() || !mcqOptionB.trim()) return;

    const optionsList = [mcqOptionA.trim(), mcqOptionB.trim(), mcqOptionC.trim(), mcqOptionD.trim()].filter(Boolean);
    let answerText = mcqOptionA.trim();
    if (mcqAnswer === "B") answerText = mcqOptionB.trim();
    else if (mcqAnswer === "C") answerText = mcqOptionC.trim();
    else if (mcqAnswer === "D") answerText = mcqOptionD.trim();

    const newMcq: MCQItem = {
      question: mcqQuestion.trim(),
      options: optionsList,
      answer: answerText,
    };

    if (editingMcqIndex !== null) {
      const updated = [...customMcqs];
      updated[editingMcqIndex] = newMcq;
      onCustomMcqsChange(updated);
    } else {
      onCustomMcqsChange([...customMcqs, newMcq]);
    }
    resetMcqForm();
    setShowMcqForm(false);
  };

  const handleEditMcq = (index: number) => {
    const mcq = customMcqs[index];
    setMcqQuestion(mcq.question);
    setMcqOptionA(mcq.options[0] || "");
    setMcqOptionB(mcq.options[1] || "");
    setMcqOptionC(mcq.options[2] || "");
    setMcqOptionD(mcq.options[3] || "");
    // Determine answer letter from answer text
    if (mcq.answer === mcq.options[1]) setMcqAnswer("B");
    else if (mcq.answer === mcq.options[2]) setMcqAnswer("C");
    else if (mcq.answer === mcq.options[3]) setMcqAnswer("D");
    else setMcqAnswer("A");
    setEditingMcqIndex(index);
    setShowMcqForm(true);
  };

  const handleDeleteMcq = (index: number) => {
    onCustomMcqsChange(customMcqs.filter((_, i) => i !== index));
  };

  const handleToggleQuestion = (question: string) => {
    if (customQuestions.includes(question)) {
      onCustomQuestionsChange(customQuestions.filter((q) => q !== question));
    } else {
      onCustomQuestionsChange([...customQuestions, question]);
    }
  };

  // @ts-ignore No more predefined question papers 
  const handleToggleSet = (paperQuestions: string[]) => {
    const allSelected = paperQuestions.every((q) => customQuestions.includes(q));
    if (allSelected) {
      onCustomQuestionsChange(customQuestions.filter((q) => !paperQuestions.includes(q)));
    } else {
      const missing = paperQuestions.filter((q) => !customQuestions.includes(q));
      onCustomQuestionsChange([...customQuestions, ...missing]);
    }
  };

  // @ts-ignore No more predefined question papers 
  const getSetCheckboxState = (paperQuestions: string[]): { checked: boolean; indeterminate: boolean } => {
    const selectedCountInSet = paperQuestions.filter((q) => customQuestions.includes(q)).length;
    return {
      checked: selectedCountInSet === paperQuestions.length,
      indeterminate: selectedCountInSet > 0 && selectedCountInSet < paperQuestions.length,
    };
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 font-semibold text-sm">
            <HelpCircle className="h-4 w-4 text-primary" />
            Select Interview Questions
          </Label>
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-0.5 rounded-full font-semibold border text-xs flex items-center gap-1 transition-all",
              customQuestions.length >= 1
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}
          >
            {customQuestions.length >= 1 ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {customQuestions.length} {customQuestions.length === 1 ? "Question" : "Questions"} Selected
          </Badge>
        </div>

        {predefinedPapers.length === 0 ? (
          <div className="p-3 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/5 text-center">
            <p className="text-sm text-muted-foreground">
              No existing question sets available to select from.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5  overflow-y-auto pr-1 border border-muted-foreground/10 rounded-xl p-1.5 bg-muted/5 scrollbar-thin">
            {predefinedPapers.map((paper) => {
              // const { checked, indeterminate } = getSetCheckboxState(paper.questions);
              return (
                <div key={paper.id} className="border border-border/40 rounded-xl overflow-hidden bg-card/50">
                  {/* Set Header */}
                  {/* <div className="flex items-center gap-1.5 px-1.5 py-1.5 bg-muted/40 border-b border-border/30 hover:bg-muted/60 transition-colors">
                    <Checkbox
                      id={`set-${paper.id}`}
                      checked={checked}
                      indeterminate={indeterminate}
                      onCheckedChange={() => handleToggleSet(paper.questions)}
                    />
                    <Label htmlFor={`set-${paper.id}`}>
                      {paper.name}
                    </Label>
                    <span className="text-xs text-muted-foreground font-medium">
                      ({paper.questions.length} questions)
                    </span>
                  </div> */}

                  {/* Set Questions */}
                  <div className="divide-y divide-border/20">
                    {paper.questions.map((q, qIdx) => {
                      const isChecked = customQuestions.includes(q);
                      return (
                        <div
                          key={qIdx}
                          className={cn(
                            "flex items-start gap-3 px-2 py-1.5 transition-colors",
                            isChecked ? "bg-primary/5" : "hover:bg-muted/20"
                          )}
                        >
                          <Checkbox
                            id={`q-${paper.id}-${qIdx}`}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleQuestion(q)}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`q-${paper.id}-${qIdx}`}
                            className={cn(
                              "text-xs leading-relaxed cursor-pointer flex-1 select-none text-foreground/80",
                              isChecked && "text-foreground font-medium"
                            )}
                          >
                            {q}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {totalUniqueQuestionsCount < 1 && <p className="text-red-500 italic text-center">No questions available. <Link to="/dashboard/questions-bank" className="hover:underline cursor-pointer">Add questions here</Link></p>}
      </div>

      {/* Custom Questions Textarea */}
      <div className="pt-2 border-t border-border/20">
        <Label className="flex items-center gap-1.5 font-semibold text-sm mb-2">
          <PenLine className="h-4 w-4 text-primary" />
          Write Custom Questions
        </Label>
        <Textarea
          value={customQuestionText}
          onChange={(e) => onCustomQuestionTextChange(e.target.value)}
          placeholder="Type your custom questions here (one question per line)..."
          className="min-h-[100px] resize-y text-sm rounded-xl border-muted-foreground/20 bg-muted/5 focus:border-primary/50"
        />

      </div>
      <div className="pt-2 border-t border-border/20">
        <label className="text-base font-bold text-muted-foreground block mb-2">
          Select Project Task Description
        </label>
        {predefinedPapers.filter((p) => p.project_task && p.project_task.length > 0).length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/5 text-center">
            <p className="text-sm text-muted-foreground">
              No existing project tasks available to select from.
            </p>
          </div>
        ) : (
          <div className=" overflow-y-auto pr-1 border border-muted-foreground/10 rounded-xl p-1.5 bg-muted/5 scrollbar-thin">
            <RadioGroup value={customProjectTask} onValueChange={onCustomProjectTaskChange} >
              {predefinedPapers.map((paper) => {
                if (!paper.project_task || paper.project_task.length === 0) return null;
                return paper.project_task.map((task, taskIdx) => {
                  const taskText = typeof task === "string" ? task : task?.task || "";
                  const isSelected = customProjectTask === taskText;
                  const optionId = `task-${paper.id}-${taskIdx}`;
                  return (
                    <div
                      key={optionId}
                      className={cn(
                        "flex items-start gap-1.5 p-1.5 rounded-xl border transition-all duration-200 cursor-pointer",
                        isSelected
                          ? "bg-primary/5 border-primary shadow-sm"
                          : "bg-card border-border/40 hover:border-muted-foreground/20"
                      )}
                      onClick={() => onCustomProjectTaskChange(taskText)}
                    >
                      <RadioGroupItem
                        value={taskText}
                        id={optionId}
                        className="mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label
                        htmlFor={optionId}
                        className="flex-1 cursor-pointer select-none space-y-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-sm font-bold text-foreground block"> Task #{taskIdx + 1}</span>
                        <span className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                          {taskText}
                        </span>
                      </label>
                    </div>
                  );
                });
              })}
            </RadioGroup>
          </div>
        )}

        {/* Custom Project Task Textarea */}
        <div className="mt-3">
          <Label className="flex items-center gap-1.5 font-semibold text-sm mb-2">
            <PenLine className="h-4 w-4 text-primary" />
            Write Custom Project Task
          </Label>
          <Textarea
            value={customProjectTaskText}
            onChange={(e) => onCustomProjectTaskTextChange(e.target.value)}
            placeholder="Type your custom project task description here..."
            className="min-h-[100px] resize-y text-sm rounded-xl border-muted-foreground/20 bg-muted/5 focus:border-primary/50"
          />
        </div>
      </div>

      {/* MCQ Section */}
      <div className="pt-2 border-t border-border/20">
        <div className="flex items-center justify-between mb-2">
          <Label className="flex items-center gap-1.5 font-semibold text-sm">
            <ListChecks className="h-4 w-4 text-primary" />
            Custom MCQs
          </Label>
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-0.5 rounded-full font-semibold border text-xs flex items-center gap-1",
              customMcqs.length > 0
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-muted/10 text-muted-foreground border-muted-foreground/20"
            )}
          >
            {customMcqs.length} {customMcqs.length === 1 ? "MCQ" : "MCQs"} Added
          </Badge>
        </div>

        {/* Added MCQs list */}
        {customMcqs.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {customMcqs.map((mcq, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-xl border border-border/40 bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {idx + 1}. {mcq.question}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mcq.options.map((opt, optIdx) => (
                      <span
                        key={optIdx}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-md border",
                          opt === mcq.answer
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold"
                            : "bg-muted/30 text-muted-foreground border-border/30"
                        )}
                      >
                        {String.fromCharCode(65 + optIdx)}: {opt}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => handleEditMcq(idx)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteMcq(idx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MCQ Inline Form */}
        {showMcqForm ? (
          <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-200">
            <div>
              <Label className="text-xs font-semibold mb-1 block">MCQ Question</Label>
              <Textarea
                value={mcqQuestion}
                onChange={(e) => setMcqQuestion(e.target.value)}
                placeholder="Enter the MCQ question text..."
                rows={2}
                className="text-sm rounded-lg border-muted-foreground/20 bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Option A</Label>
                <Input
                  value={mcqOptionA}
                  onChange={(e) => setMcqOptionA(e.target.value)}
                  placeholder="Option A"
                  className="text-sm rounded-lg border-muted-foreground/20 bg-background"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Option B</Label>
                <Input
                  value={mcqOptionB}
                  onChange={(e) => setMcqOptionB(e.target.value)}
                  placeholder="Option B"
                  className="text-sm rounded-lg border-muted-foreground/20 bg-background"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Option C (Optional)</Label>
                <Input
                  value={mcqOptionC}
                  onChange={(e) => setMcqOptionC(e.target.value)}
                  placeholder="Option C"
                  className="text-sm rounded-lg border-muted-foreground/20 bg-background"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Option D (Optional)</Label>
                <Input
                  value={mcqOptionD}
                  onChange={(e) => setMcqOptionD(e.target.value)}
                  placeholder="Option D"
                  className="text-sm rounded-lg border-muted-foreground/20 bg-background"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Correct Answer</Label>
              <Select value={mcqAnswer} onValueChange={(value) => setMcqAnswer(value as "A" | "B" | "C" | "D")}>
                <SelectTrigger className="text-sm rounded-lg border-muted-foreground/20 bg-background">
                  <SelectValue placeholder="Select correct option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Option A</SelectItem>
                  <SelectItem value="B">Option B</SelectItem>
                  <SelectItem value="C" disabled={!mcqOptionC.trim()}>Option C{!mcqOptionC.trim() && " (Fill Option C)"}</SelectItem>
                  <SelectItem value="D" disabled={!mcqOptionD.trim()}>Option D{!mcqOptionD.trim() && " (Fill Option D)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs rounded-lg"
                onClick={() => { resetMcqForm(); setShowMcqForm(false); }}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs rounded-lg"
                disabled={!mcqQuestion.trim() || !mcqOptionA.trim() || !mcqOptionB.trim()}
                onClick={handleSaveMcq}
              >
                {editingMcqIndex !== null ? "Update MCQ" : "Add MCQ"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-dashed border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
            onClick={() => setShowMcqForm(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add MCQ
          </Button>
        )}
      </div>
    </div>
  );
}
