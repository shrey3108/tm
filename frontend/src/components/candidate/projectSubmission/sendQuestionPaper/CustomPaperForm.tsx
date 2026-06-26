import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import type { MCQItem } from "@/types/taskPaper";
import { PenLine, Plus, Trash2, Pencil, X, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Required } from "@/components/job-form/Required";

interface CustomPaperFormProps {
  customQuestions: string[];
  onCustomQuestionsChange: (value: string[]) => void;
  customProjectTasks: string[];
  onCustomProjectTasksChange: (value: string[]) => void;
  customMcqs: MCQItem[];
  onCustomMcqsChange: (mcqs: MCQItem[]) => void;
  hideManualInput?: boolean;
}

export function CustomPaperForm({
  customQuestions = [],
  onCustomQuestionsChange,
  customProjectTasks = [],
  onCustomProjectTasksChange,
  customMcqs = [],
  onCustomMcqsChange,
  hideManualInput = false,
}: CustomPaperFormProps) {
  // MCQ inline form state
  const [showMcqForm, setShowMcqForm] = useState(false);
  const [editingMcqIndex, setEditingMcqIndex] = useState<number | null>(null);
  const [mcqQuestion, setMcqQuestion] = useState("");
  const [mcqOptionA, setMcqOptionA] = useState("");
  const [mcqOptionB, setMcqOptionB] = useState("");
  const [mcqOptionC, setMcqOptionC] = useState("");
  const [mcqOptionD, setMcqOptionD] = useState("");
  const [mcqAnswer, setMcqAnswer] = useState<string>("A");

  // Question inline input state
  const [questionInput, setQuestionInput] = useState("");

  // Task inline input state
  const [taskInput, setTaskInput] = useState("");
  const [taskInstructionInput, setTaskInstructionInput] = useState("");

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

  const handleAddQuestion = () => {
    if (!questionInput.trim()) return;
    onCustomQuestionsChange([...customQuestions, questionInput.trim()]);
    setQuestionInput("");
  };

  const handleDeleteQuestion = (index: number) => {
    onCustomQuestionsChange(customQuestions.filter((_, i) => i !== index));
  };

  const handleAddTask = () => {
    if (!taskInput.trim() || !taskInstructionInput.trim()) return;
    const combinedTask = `Task:\n${taskInput.trim()}\n\nInstructions:\n${taskInstructionInput.trim()}`;
    onCustomProjectTasksChange([...customProjectTasks, combinedTask]);
    setTaskInput("");
    setTaskInstructionInput("");
  };

  const handleDeleteTask = (index: number) => {
    onCustomProjectTasksChange(customProjectTasks.filter((_, i) => i !== index));
  };

  if (hideManualInput) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Custom Questions Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="flex items-center gap-1.5 font-semibold text-sm">
            <PenLine className="h-4 w-4 text-primary" />
            Extra Questions <Required />
          </Label>
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-0.5 rounded-full font-semibold border text-xs flex items-center gap-1",
              customQuestions.length > 0
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-muted/10 text-muted-foreground border-muted-foreground/20"
            )}
          >
            {customQuestions.length} {customQuestions.length === 1 ? "Question" : "Questions"} Added
          </Badge>
        </div>

        {/* Added Questions list */}
        {customQuestions.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {customQuestions.map((q, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-xl border border-border/40 bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-foreground block mb-0.5">
                    Extra Question #{idx + 1}
                  </span>
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {q}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDeleteQuestion(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Type your extra question description here..."
            className="min-h-[80px] resize-y text-sm rounded-xl border-muted-foreground/20 bg-muted/5 focus:border-primary/50"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-dashed border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold"
            onClick={handleAddQuestion}
            disabled={!questionInput.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Custom Project Tasks Section */}
      <div className="pt-2 border-t border-border/20">
        <div className="flex items-center justify-between mb-2">
          <Label className="flex items-center gap-1.5 font-semibold text-sm">
            <PenLine className="h-4 w-4 text-primary" />
            Extra Project Tasks <Required />
          </Label>
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-0.5 rounded-full font-semibold border text-xs flex items-center gap-1",
              customProjectTasks.length > 0
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-muted/10 text-muted-foreground border-muted-foreground/20"
            )}
          >
            {customProjectTasks.length} {customProjectTasks.length === 1 ? "Task" : "Tasks"} Added
          </Badge>
        </div>

        {/* Added Tasks list */}
        {customProjectTasks.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {customProjectTasks.map((task, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-xl border border-border/40 bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-foreground block mb-0.5">
                    Extra Task #{idx + 1}
                  </span>
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {task}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDeleteTask(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Project Task</Label>
            <Textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Type your extra project task description here..."
              className="min-h-[80px] resize-y text-sm rounded-xl border-muted-foreground/20 bg-muted/5 focus:border-primary/50"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Instructions</Label>
            <Textarea
              value={taskInstructionInput}
              onChange={(e) => setTaskInstructionInput(e.target.value)}
              placeholder="Type instructions for the project task here..."
              className="min-h-[80px] resize-y text-sm rounded-xl border-muted-foreground/20 bg-muted/5 focus:border-primary/50"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-dashed border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold"
            onClick={handleAddTask}
            disabled={!taskInput.trim() || !taskInstructionInput.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Project Task
          </Button>
        </div>
      </div>

      {/* MCQ Section */}
      <div className="pt-2 border-t border-border/20">
        <div className="flex items-center justify-between mb-2">
          <Label className="flex items-center gap-1.5 font-semibold text-sm">
            <ListChecks className="h-4 w-4 text-primary" />
            Extra MCQs <Required />
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
                          "text-sm px-1.5 py-0.5 rounded-md border",
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
              <Select value={mcqAnswer} onValueChange={(value) => setMcqAnswer(value as "A" | "B" | "C" | "D")} modal={false}>
                <SelectTrigger className="text-sm rounded-lg border-muted-foreground/20 bg-background">
                  <SelectValue placeholder="Select correct option" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
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
            className="w-full rounded-xl border-dashed border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-semibold"
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
