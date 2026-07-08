// import { Button } from "@/components/ui/button";
import type { CandidateTestPaperRead } from "@/types/taskPaper";
import { PaperContentDisplay } from "@/components/shared/PaperContentDisplay";
import { useMemo } from "react";
import { formatDuration } from "@/utils/taskFormatter";
import { TotalDuration } from "@/components/shared/question/TotalDuration";
import { TotalMarks } from "@/components/shared/question/TotalMarks";
import { PaperGuidelineDisplay } from "./PaperGuidelineDisplay";

interface AssignedPaperViewProps {
  assignedPaper: CandidateTestPaperRead;
  onUnassign: () => Promise<void> | void;
  isUnassigning: boolean;
  readOnly?: boolean;
}

export function AssignedPaperView({
  assignedPaper,
  // onUnassign,
  // isUnassigning,
}: AssignedPaperViewProps) {
  const finalQuestions = useMemo(() => [...(assignedPaper?.questions ?? [])], [assignedPaper?.questions]);
  const finalMCQs = useMemo(() => [...(assignedPaper?.mcqs ?? [])], [assignedPaper?.mcqs]);
  const finalTasks = useMemo(() => [...(assignedPaper?.project_task ?? [])], [assignedPaper?.project_task]);

  // Compute total duration of the currently configured paper (selected + custom)
  const finalTotalDuration = useMemo(() => {
    const qDur = finalQuestions.reduce((sum, q) => sum + (q.duration || 3), 0);
    const mDur = finalMCQs.reduce((sum, m) => sum + (m.duration || 3), 0);
    const tDur = finalTasks.reduce((sum, t) => sum + (t.duration || t.total_duration || 30), 0);
    return qDur + mDur + tDur;
  }, [finalQuestions, finalMCQs, finalTasks]);

  const finalTotalMarks = useMemo(() => {
    const qMarks = finalQuestions.reduce((sum, q) => sum + (q.marks || 5), 0);
    const mMarks = finalMCQs.reduce((sum, m) => sum + (m.marks || 5), 0);
    const tMarks = finalTasks.reduce((sum, t) => {
      if (typeof t === "string") return sum + 0;
      const calculatedMarks = t.total_marks || t.tasks?.reduce((subSum, st) => subSum + (st.marks || 0), 0) || 0;
      return sum + calculatedMarks;
    }, 0);
    return qMarks + mMarks + tMarks;
  }, [finalQuestions, finalMCQs, finalTasks]);

  return (
    <div className="space-y-1.5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded-xl ">
        <div className="space-y-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
          <div className="w-full">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Assigned Test Paper
            </span>
            <div className="flex items-center justify-between w-full">

              <h3 className="text-base font-bold text-foreground capitalize">
                {assignedPaper.name}
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <TotalMarks totalMarks={finalTotalMarks} />
                <TotalDuration totalDuration={formatDuration(finalTotalDuration)} />
              </div>
            </div>
          </div>

        </div>
        {/* <Button
          variant="outline"
          size="sm"
          onClick={onUnassign}
          disabled={isUnassigning}
          className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all font-semibold"
        >
          Change Existing Paper
        </Button> */}
      </div>
      {/* <div className="flex items-center justify-end">
        <div className="flex flex-wrap items-center gap-3">
          <TotalMarks totalMarks={finalTotalMarks} />
          <TotalDuration totalDuration={formatDuration(finalTotalDuration)} />
        </div>
      </div> */}

      <PaperGuidelineDisplay guidelineContent={assignedPaper.guideline_content} />

      <div className="p-2 border border-border/40 rounded-xl bg-card">
        <PaperContentDisplay
          questions={assignedPaper.questions}
          mcqs={assignedPaper.mcqs}
          project_task={assignedPaper.project_task}
        />
      </div>
    </div>
  );
}
