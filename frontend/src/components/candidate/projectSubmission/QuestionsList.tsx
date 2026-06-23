import { useState } from "react";
import { Edit2, Trash2, X, Plus, CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  QuestionModal,
  DeleteModal,
  ProjectTaskModal,
  MCQModal,
} from "@/components/modal";
import type { QuestionSetPaperRead, MCQItem } from "@/types/taskPaper";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { CreateSkillModal } from "@/components/modal";
import { SkillSelectorSection } from "@/components/job-form/SkillSelectorSection";
import { Form } from "@/components/ui/form";

interface QuestionsListProps {
  paper: QuestionSetPaperRead;
  onAddQuestion: (text: string) => void;
  onUpdateQuestion: (index: number, text: string) => void;
  onDeleteQuestion: (index: number) => void;
  onAddMCQ: (mcq: MCQItem) => void;
  onUpdateMCQ: (index: number, mcq: MCQItem) => void;
  onDeleteMCQ: (index: number) => void;
  onAddTask: (text: string) => void;
  onUpdateTask: (index: number, text: string) => void;
  onDeleteTask: (index: number) => void;
  onUpdateSkills: (skills: string[]) => void;
  form: any;
}

export function QuestionsList({
  paper,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onAddMCQ,
  onUpdateMCQ,
  onDeleteMCQ,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onUpdateSkills,
  form
}: QuestionsListProps) {
  // Modals visibility state
  const [activeModal, setActiveModal] = useState<"question" | "mcq" | "task" | "delete" | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Modal values state
  const [questionText, setQuestionText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [mcqValue, setMCQValue] = useState<MCQItem | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: "question" | "mcq" | "task"; index: number } | null>(null);

  // Skill Modal state
  const [showSkillModal, setShowSkillModal] = useState(false);

  // Normal Question handlers
  const handleOpenAddQuestion = () => {
    setModalMode("add");
    setQuestionText("");
    setSelectedIndex(null);
    setActiveModal("question");
  };

  const handleOpenEditQuestion = (index: number, text: string) => {
    setModalMode("edit");
    setQuestionText(text);
    setSelectedIndex(index);
    setActiveModal("question");
  };

  const handleSaveQuestion = async (text: string) => {
    if (modalMode === "add") {
      onAddQuestion(text);
    } else if (modalMode === "edit" && selectedIndex !== null) {
      onUpdateQuestion(selectedIndex, text);
    }
    setActiveModal(null);
  };

  // Project Task handlers
  const handleOpenAddTask = () => {
    setModalMode("add");
    setTaskText("");
    setSelectedIndex(null);
    setActiveModal("task");
  };

  const handleOpenEditTask = (index: number, text: string) => {
    setModalMode("edit");
    setTaskText(text);
    setSelectedIndex(index);
    setActiveModal("task");
  };

  const handleSaveTask = async (text: string) => {
    if (modalMode === "add") {
      onAddTask(text);
    } else if (modalMode === "edit" && selectedIndex !== null) {
      onUpdateTask(selectedIndex, text);
    }
    setActiveModal(null);
  };

  // MCQ handlers
  const handleOpenAddMCQ = () => {
    setModalMode("add");
    setMCQValue(null);
    setSelectedIndex(null);
    setActiveModal("mcq");
  };

  const handleOpenEditMCQ = (index: number, mcq: MCQItem) => {
    setModalMode("edit");
    setMCQValue(mcq);
    setSelectedIndex(index);
    setActiveModal("mcq");
  };

  const handleSaveMCQ = async (mcq: MCQItem) => {
    if (modalMode === "add") {
      onAddMCQ(mcq);
    } else if (modalMode === "edit" && selectedIndex !== null) {
      onUpdateMCQ(selectedIndex, mcq);
    }
    setActiveModal(null);
  };

  // Delete Handlers
  const handleOpenDeleteConfirm = (type: "question" | "mcq" | "task", index: number) => {
    setDeleteTarget({ type, index });
    setActiveModal("delete");
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, index } = deleteTarget;
    if (type === "question") onDeleteQuestion(index);
    else if (type === "mcq") onDeleteMCQ(index);
    else if (type === "task") onDeleteTask(index);
    setActiveModal(null);
    setDeleteTarget(null);
  };

  // Skill Handlers
  const handleRemoveSkill = (skillToRemove: string) => {
    const nextSkills = (paper.task_skills || []).filter(s => s !== skillToRemove);
    onUpdateSkills(nextSkills);
  };

  const handleSkillCreated = () => {
    // Refresh skills is handled inside the modal component, but we can close it
    setShowSkillModal(false);
  };

  // Render question cards with index
  let globalIndex = 0;

  return (
    <div className="space-y-2 mx-auto pb-4">
      {/* Predefined Paper Header Info */}
      <div className="flex items-center justify-between border-b pb-3 border-border/40">

      </div>

      {/* Questions & Tasks Render */}
      <div className="space-y-1.5">
        {/* Normal Questions */}
        {paper.questions?.map((q, index) => {
          globalIndex++;
          return (
            <div
              key={`q-${index}`}
              className="flex items-start justify-between p-1.5 rounded-xl border border-border/80 bg-card hover:shadow-sm transition-all animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Normal Question</span>
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {globalIndex}. {q}
                </p>
              </div>
              <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEditQuestion(index, q)}
                    className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDeleteConfirm("question", index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </PermissionGuard>
            </div>
          );
        })}

        {/* MCQ Questions */}
        {paper.mcqs?.map((m, index) => {
          globalIndex++;
          return (
            <div
              key={`mcq-${index}`}
              className="flex items-start justify-between p-1.5 rounded-xl border border-border/80 bg-card hover:shadow-sm transition-all animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              <div className="space-y-2 flex-1">
                <div>
                  <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider block">MCQ Based Question</span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {globalIndex}. {m.question}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 pl-4 max-w-xl">
                  {m.options.map((opt, oIdx) => {
                    const optionLetter = String.fromCharCode(65 + oIdx); // A, B, C, D
                    const isCorrect = opt === m.answer;
                    return (
                      <div
                        key={oIdx}
                        className={`text-xs p-1.5 rounded-lg border flex items-center justify-between ${isCorrect
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 font-semibold"
                          : "bg-muted/40 border-transparent text-muted-foreground"
                          }`}
                      >
                        <span>{optionLetter}. {opt}</span>
                        {isCorrect && <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEditMCQ(index, m)}
                    className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDeleteConfirm("mcq", index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </PermissionGuard>
            </div>
          );
        })}

        {/* Project Tasks */}
        {paper.project_task?.map((t, index) => {
          globalIndex++;
          return (
            <div
              key={`task-${index}`}
              className="flex items-start justify-between p-1.5 rounded-xl border border-border/80 bg-card hover:shadow-sm transition-all animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Project Task / Instruction</span>
                <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                  {globalIndex}. {t}
                </p>
              </div>
              <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEditTask(index, t)}
                    className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDeleteConfirm("task", index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </PermissionGuard>
            </div>
          );
        })}

        {/* Empty State */}
        {globalIndex === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-border/60 rounded-xl text-muted-foreground text-sm">
            No questions defined in this paper template yet. Click the card below to add questions.
          </div>
        )}

        {/* Dotted Dotted Add Question Card (shows options on hover) */}
        <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
          <div className="group relative border-2 border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center min-h-[56px] transition-all hover:border-primary/50 hover:bg-muted/10 duration-200">
            <span className="text-sm font-semibold text-muted-foreground group-hover:opacity-0 transition-opacity duration-200 flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add Question
            </span>
            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-background/95 rounded-xl border border-primary/20 shadow-sm">
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={handleOpenAddQuestion}>
                Normal Question
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={handleOpenAddMCQ}>
                MCQ (2-4 Options)
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={handleOpenAddTask}>
                Project Task
              </Button>
            </div>
          </div>
        </PermissionGuard>
      </div>

      {/* Skills Section */}

      <div className="pt-4 border-t border-border/40 space-y-2">
        <h4 className="text-sm font-bold text-foreground">Linked Skills</h4>
        <div className="flex flex-wrap gap-1.5 items-center">
          {paper.task_skills && paper.task_skills.length > 0 ? (
            paper.task_skills.map((skill, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="pl-2 pr-1.5 py-0.5 rounded-full flex items-center gap-1 bg-primary/10 text-primary border-none font-bold text-xs"
              >
                {skill}
                <button
                  onClick={() => handleRemoveSkill(skill)}
                  className="text-primary/70 hover:text-primary hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">No skills linked to this question bank.</p>
          )}

          <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
            <Form {...form}>
              <div className="rounded-2xl overflow-hidden w-full">
                <SkillSelectorSection initialSelectedSkills={[]} placeholderMessage="Assign relevant skills to this question bank" />
              </div>
            </Form>
          </PermissionGuard>
        </div>
      </div>

      {/* Interactive Modals */}
      <QuestionModal
        show={activeModal === "question"}
        handleClose={() => setActiveModal(null)}
        onSave={handleSaveQuestion}
        initialValue={modalMode === "edit" ? questionText : ""}
        isSaving={false}
      />

      <ProjectTaskModal
        show={activeModal === "task"}
        handleClose={() => setActiveModal(null)}
        onSave={handleSaveTask}
        initialValue={modalMode === "edit" ? taskText : ""}
        isSaving={false}
      />

      <MCQModal
        show={activeModal === "mcq"}
        handleClose={() => setActiveModal(null)}
        onSave={handleSaveMCQ}
        initialValue={modalMode === "edit" ? mcqValue : null}
        isSaving={false}
      />

      <DeleteModal
        show={activeModal === "delete"}
        handleClose={() => {
          setActiveModal(null);
          setDeleteTarget(null);
        }}
        handleConfirm={handleConfirmDelete}
        title="Delete Item"
        message="Are you sure you want to delete this question? This action will remove it from the list."
        isLoading={false}
      />

      <CreateSkillModal
        show={showSkillModal}
        handleClose={() => setShowSkillModal(false)}
        onSkillSaved={handleSkillCreated}
        skill={null}
      />
    </div>
  );
}
