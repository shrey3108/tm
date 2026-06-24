import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

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
      header: () => <div className="pl-4 font-semibold w-12 text-left">Number</div>,
      cell: ({ row }) => <div className="pl-4 text-left font-medium">{row.index + 1}</div>,
    },
    {
      accessorKey: "content",
      header: () => (
        <div className="min-w-[400px]">
          <span className="font-semibold">Content</span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="min-w-[400px] whitespace-pre-wrap py-2 text-foreground/90 font-medium">
          {row.original.content}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: () => <div className="font-semibold">Type</div>,
      cell: ({ row }) => {
        const typeLabels: Record<FlatItem["type"], string> = {
          question: "Default",
          project_task: "Project Task",
          mcq: "MCQ",
        };
        const typeStyles: Record<FlatItem["type"], string> = {
          question: "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20",
          project_task: "bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20",
          mcq: "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20",
        };
        return (
          <Badge className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", typeStyles[row.original.type])}>
            {typeLabels[row.original.type]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "skills",
      header: () => <div className="font-semibold">Skills</div>,
      cell: ({ row }) => {
        const skills = row.original.skills;
        if (!skills || skills.length === 0) {
          return <span className="text-muted-foreground text-xs italic">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {skills.map((skill) => (
              <Badge
                key={skill.id}
                variant="secondary"
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary/40 hover:bg-secondary text-secondary-foreground border border-muted-foreground/5 transition-colors whitespace-nowrap"
              >
                {skill.name}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <div className="flex items-center justify-center gap-2">
          <span className="font-semibold">Actions</span>
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
                    className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                  >
                    <Edit2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                <span className="text-primary">Edit Item</span>
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
                    className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                  >
                    <Trash2Icon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs font-medium" side="top">
                <span className="text-destructive">Delete Item</span>
              </HoverCardContent>
            </HoverCard>
          </div>
        </PermissionGuard>
      ),
    },
  ];
