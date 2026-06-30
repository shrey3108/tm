import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2Icon, Award, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/taskFormatter";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import SkillsBadgeList from "@/components/shared/SkillsBadgeList";


export interface FlatItem {
  id: string;
  content: string;
  type: "question" | "project_task" | "mcq";
  paperId: string;      // paper UUID for API calls
  itemIndex: number;    // index within the paper's array
  rawData?: any;        // full MCQItem for edit modal
  paperName?: string;   // paper name for optional column
  skills?: Array<{ id: string; name: string }>;
}

interface ColumnHandlers {
  onEdit: (item: FlatItem) => void;
  onDelete: (item: FlatItem) => void;
}

export const getQuestionsBankColumns = ({
  onEdit,
  onDelete,
}: ColumnHandlers): ColumnDef<FlatItem>[] => [
    {
      id: "index",
      header: () => <div className="flex items-center justify-center">No.</div>,
      cell: ({ row }) => <div className="flex items-center justify-center text-base">{row.index + 1}</div>,
    },
    {
      accessorKey: "content",
      header: () => (
        <div className="min-w-[400px] ">
          <span className="text-base">Content</span>
        </div>
      ),
      cell: ({ row }) => {
        const item = row.original;
        if (item.type === "project_task" && item.rawData && typeof item.rawData !== "string") {
          const tasks = item.rawData.tasks || [];
          const totalMarks = item.rawData.total_marks ?? tasks.reduce((sum: number, t: any) => sum + (t.marks || 0), 0);
          const totalDuration = item.rawData.duration;

          return (
            <div className="min-w-[400px] whitespace-pre-wrap wrap-break-word space-y-1">
              <div className="font-semibold text-foreground">{item.content}</div>
              {tasks.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-full">
                    <Award className="h-3 w-3" /> {totalMarks} Marks
                  </span>
                  <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" /> {formatDuration(totalDuration)}
                  </span>
                  <span className="text-muted-foreground/80">({tasks.length} sub-task{tasks.length > 1 ? "s" : ""})</span>
                </div>
              )}
            </div>
          );
        }

        if ((item.type === "question" || item.type === "mcq") && item.rawData && typeof item.rawData !== "string") {
          const marks = item.rawData.marks;
          const duration = item.rawData.duration;

          return (
            <div className="min-w-[400px] whitespace-pre-wrap wrap-break-word space-y-1">
              <div className="font-medium text-foreground">{item.content}</div>
              {(marks !== undefined || (duration !== undefined && duration > 0)) && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  {marks !== undefined && (
                    <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-full">
                      <Award className="h-3 w-3" /> {marks} Marks
                    </span>
                  )}
                  {duration !== undefined && duration > 0 && (
                    <span className="inline-flex items-center gap-1 bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" /> {formatDuration(duration)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        }

        return (
          <div className="min-w-[400px] whitespace-pre-wrap wrap-break-word">
            {row.original.content}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: () => <div className=" flex items-center justify-center">Type</div>,
      cell: ({ row }) => {
        const typeLabels: Record<FlatItem["type"], string> = {
          question: "Default",
          project_task: "Project Task",
          mcq: "MCQ",
        };
        return (
          <span className={cn("flex items-center justify-center text-sm")}>
            {typeLabels[row.original.type]}
          </span>
        );
      },
    },
    {
      accessorKey: "skills",
      header: () => (
        <div className="flex items-center gap-2 min-w-[160px]">
          <span className="">Skills</span>
        </div>
      ),
      cell: ({ row }) => {
        const skills = row.original.skills;
        if (!skills || skills.length === 0) {
          return (
            <div className="min-w-[160px] max-w-[220px]">
              <span className="italic">N/A</span>
            </div>
          );
        }
        return (
          <div className="min-w-[160px] max-w-[220px]">
            <SkillsBadgeList skills={row.original.skills} maxVisible={2} />
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <div className="flex items-center justify-center gap-2">
          <span className="">Actions</span>
        </div>
      ),
      cell: ({ row }) => (
        <PermissionGuard permissions={PERMISSIONS.QUESTIONS_MANAGE} hideWhenDenied>
          <div className="gap-2 flex items-center justify-center">
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(row.original)}
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                  >
                    <Edit2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Edit Item
              </HoverCardContent>
            </HoverCard>

            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(row.original)}
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Delete Item
              </HoverCardContent>
            </HoverCard>
          </div>
        </PermissionGuard>
      ),
    },
  ];
