import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DateDisplay } from "@/components/shared/DateDisplay";
import SkillsBadgeList from "@/components/shared/SkillsBadgeList";
import type { Job } from "@/types/job";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { Edit2, Users, ArrowUpDown, Trash2Icon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { PERMISSIONS } from "@/lib/permissions";
import { JobStatus } from "@/components/shared/JobStatus";

/**
 * Row-level action callbacks consumed by {@link getJobColumns}.
 */
interface ColumnHandlers {
  onToggleStatus: (job: Job) => void;
  onDelete: (job: Job) => void;
  onEdit: (job: Job) => void;
  onCandidates: (job: Job) => void;
  onViewSessions: (job: Job) => void;
  onSessionCandidates: (job: Job, startDate: string, endDate?: string) => void;
  loadingJobId?: string | null;
}

/**
 * Builds the column definitions for the job-board data table.
 *
 * Columns include title (with version badge and department), active-status
 * toggle, creation date, skills list, and action buttons for edit, delete,
 * and view candidates.
 *
 * @param handlers - Row-level action callbacks wired to the parent page.
 * @returns An array of TanStack Table column definitions for {@link Job}.
 */
export const getJobColumns = ({
  onToggleStatus,
  onDelete,
  onEdit,
  onCandidates,
  // onViewSessions,
  // onSessionCandidates,
  loadingJobId,
}: ColumnHandlers): ColumnDef<Job>[] => [
    {
      accessorKey: "title",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Title
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 min-w-50 max-w-[320px]">
          <div className="flex items-center gap-2">
            <span
              className="font-medium text-wrap capitalize"
            // text-sm md:text-base lg:text-base xl:text-xl 2xl:text-2xl
            >
              {row.original.title}

              {(row.original.version ?? row.original.processing_version) && (
                <Badge
                  variant="secondary"
                  className="h-5 text-xs font-normal rounded-md shrink-0 ml-0.5"
                >
                  v{row.original.processing_version ?? row.original.version}
                </Badge>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-sm text-muted-foreground truncate capitalize"
              title={row.original.department?.name || "No Department"}
            >
              {row.original.department?.name || "No Department"}
            </span>
            <Badge
              variant="outline"
              className="text-xs font-normal h-5 px-1.5 rounded-md border-muted-foreground/20 shrink-0"
            >
              {row.original.vacancy != null ? (
                <span> <span className="font-bold">{row.original.vacancy}</span> Openings</span>
              ) : (
                <span>No Openings</span>
              )}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => {
        return (
          <PermissionGuard
            permissions={PERMISSIONS.JOBS_MANAGE}
            hideWhenDenied={true}
          >
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="hover:bg-transparent p-0 font-semibold text-base"
            >
              Status
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </PermissionGuard>
        );
      },
      cell: ({ row }) => (
        <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
          <div className="flex items-center justify-center gap-3 max-w-[100px] ">
            <JobStatus
              job={row.original}
              onToggleStatus={() => onToggleStatus(row.original)}
            />
          </div>
        </PermissionGuard>
      ),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold text-base"
          >
            Created
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <DateDisplay date={row.getValue("created_at")} showIcon className="text-sm" />
      ),
    },
    // {
    //   accessorKey: "activity_sessions",
    //   : "Hiring Activity",
    //   header: () => {
    //     return (
    //       <div className="flex items-center gap-2">
    //         <span className="text-base">Hiring Activity</span>
    //       </div>
    //     )
    //   },
    //   cell: ({ row }) => {
    //     const sessions = row.original.activity_sessions || [];
    //     const displaySessions = sessions.slice(-3).reverse(); // Show last 3 sessions // use -3 and reverse() if reverse needed

    //     const remainingCount = sessions.length - 3;
    //     const totalCandidates = row.original.total_candidates || 0;

    //     return (
    //       <div className="flex flex-col gap-0.5 min-w-[140px]">
    //         {sessions.length === 0 ? (
    //           <span className="text-xs text-muted-foreground italic">
    //             No sessions
    //           </span>
    //         ) : (
    //           <>
    //             {displaySessions.map((s) => (
    //               <div
    //                 key={s.session_id}
    //                 className="flex items-center text-xs"
    //               // onClick={(e) => {
    //               //   e.stopPropagation();
    //               //   onSessionCandidates(row.original, s.start_date, s.end_date);
    //               // }}
    //               >
    //                 <div className="flex items-center gap-1 overflow-hidden">
    //                   {displaySessions.length > 1 && (
    //                     <Badge
    //                       variant="outline"
    //                       className="h-5 px-1 py-0 text-[10px] leading-none border-primary/20 bg-primary/5"
    //                     >
    //                       #{s.session_id}
    //                     </Badge>
    //                   )}
    //                   <span className="truncate mr-0.5">
    //                     <DateDisplay date={s.start_date} className="text-sm" />
    //                   </span>
    //                 </div>
    //                 <HoverCard>
    //                   <HoverCardTrigger
    //                     render={(props) => (
    //                       <Badge
    //                         {...props}
    //                         variant="outline"
    //                         className="cursor-pointer text-sm font-normal h-5 px-1.5 rounded-md border-muted-foreground/20 hover:border-primary/30 hover:bg-primary/5"
    //                         onClick={(e) => {
    //                           e.stopPropagation();
    //                           onSessionCandidates(row.original, s.start_date, s.end_date as string);
    //                         }}
    //                       >
    //                         <Users className="h-4 w-4" /><span className=" group-hover/session:text-primary transition-colors" >  {s.candidate_count}</span>
    //                       </Badge>
    //                     )}
    //                   />
    //  <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
    //                     <div className="text-[14px] font-semibold text-primary">
    //                       Candidates for this session
    //                     </div>
    //                   </HoverCardContent>
    //                 </HoverCard>
    //               </div>
    //             ))}
    //             {remainingCount > 0 && (
    //               <Button
    //                 variant="link"
    //                 size="sm"
    //                 className="h-auto p-0 text-primary font-semibold hover:no-underline flex justify-start w-fit group"
    //                 onClick={() => onViewSessions(row.original)}
    //               >
    //                 + {remainingCount} more
    //                 <span className="ml-1 opacity-100 group-hover:translate-x-1 transition-transform">
    //                   →
    //                 </span>
    //               </Button>
    //             )}
    //             {sessions.length <= 3 && (
    //               <Button
    //                 variant="link"
    //                 size="sm"
    //                 className="h-auto p-0 hover:text-primary transition-colors font-medium hover:no-underline flex justify-start w-fit"
    //                 onClick={() => onViewSessions(row.original)}
    //               >
    //                 View details
    //               </Button>
    //             )}
    //           </>
    //         )}

    //         <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40">
    //           <span className="text-xs font-semibold text-muted-foreground">
    //             Total candidates:{" "}
    //             <span className="font-medium text-foreground">
    //               {totalCandidates}
    //             </span>
    //           </span>
    //         </div>
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "total_candidates",
      header: ({ column }) => {
        return <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-transparent p-0 font-semibold text-base"
        >
          Total candidates
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      },
      cell: ({ row }) => {
        return (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-normal">{row.original.total_candidates}</span>
          </div>
        )
      }
    },
    {
      accessorKey: "skills",

      header: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">Skills</span>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="min-w-[160px] max-w-[220px]">
          <SkillsBadgeList
            skills={row.original.skills}
            maxVisible={2}
          />
        </div>
      ),
    },
    {
      id: "actions",

      header: () => {
        return (
          <div className="flex items-center justify-center gap-2">
            <span className="text-base">Actions</span>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-0.5">
          <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60"
                    onClick={() => onEdit(row.original)}
                    isLoading={loadingJobId === row.original.id}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Edit Job
              </HoverCardContent>
            </HoverCard>
          </PermissionGuard>
          <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60"
                    onClick={() => onDelete(row.original)}
                    disabled={!!row.original.is_active}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                Delete Job
              </HoverCardContent>
            </HoverCard>
          </PermissionGuard>
          <PermissionGuard
            permissions={PERMISSIONS.CANDIDATES_ACCESS}
            hideWhenDenied
          >
            <HoverCard>
              <HoverCardTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl hover:bg-gray-200/60"
                    onClick={() => onCandidates(row.original)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                )}
              />
              <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                View Candidates
              </HoverCardContent>
            </HoverCard>
          </PermissionGuard>
        </div>
      ),
    },
  ];
