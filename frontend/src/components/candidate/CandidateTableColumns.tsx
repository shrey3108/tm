import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  ExternalLink,
  // Loader2
} from "lucide-react";
import { DateDisplay } from "@/components/shared/DateDisplay";
import StatusBadge from "@/components/shared/StatusBadge";
import HRDecisionBadge from "@/components/shared/HRDecisionBadge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { GithubLogo, LinkedinLogo } from "@/components/logo";
import { cn, capitalize, toTitleCase } from "@/lib/utils";
import type { UnifiedCandidate } from "@/types/candidate";
import { Link } from "react-router-dom";
import { slugify } from "@/utils/slug";
import { DEFAULT_PASSING_THRESHOLD, RESUME_SCREENING_RESULT } from "@/constants";
function scoreColor(score: number, threshold: number = DEFAULT_PASSING_THRESHOLD) {
  if (score >= 80) return "bg-green-500";
  if (score >= threshold) return "bg-yellow-500";
  return "bg-red-500";
}

function isValidUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed !== "" &&
    trimmed !== "n/a" &&
    trimmed !== "null" &&
    trimmed !== "undefined"
  );
}

interface UseCandidateTableColumnsProps<T extends UnifiedCandidate> {
  renderActions?: (candidate: T) => React.ReactNode;
  passing_threshold?: number;
  showJobContext?: boolean;
}

export const useCandidateTableColumns = <T extends UnifiedCandidate>({
  renderActions,
  passing_threshold = DEFAULT_PASSING_THRESHOLD,
  showJobContext = false,
}: UseCandidateTableColumnsProps<T>) => {
  return useMemo<ColumnDef<T>[]>(
    () => [
      // 1. CANDIDATE
      {
        id: "candidate",
        accessorFn: (row) =>
          `${row.first_name || ""} ${row.last_name || ""}`.trim(),
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold "
          >
            Candidate
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const c = row.original;
          const isProcessing =
            c.processing_status === "processing" || !c.is_parsed;
          const fullName =
            `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
            "Unknown Candidate";
          return (
            <div className="flex flex-col gap-0.5 min-w-[160px] max-w-[250px]">
              <span
                className="font-bold  text-foreground truncate block capitalize"
                title={fullName}
              >
                {isProcessing && !c.first_name ? (
                  <span className="text-muted-foreground italic text-sm">
                    Processing…
                  </span>
                ) : (
                  toTitleCase(fullName)
                )}
              </span>
              <span className="text-muted-foreground truncate block" title={c.email || "N/A"}>
                {c.email || "N/A"}
              </span>
              <span className="text-muted-foreground truncate block" title={c.phone || "N/A"}>
                {c.phone || "N/A"}
              </span>
            </div>
          );
        },
      },
      // 1.5 JOB CONTEXT (Conditional)
      ...(showJobContext
        ? [
          {
            id: "job_context",
            accessorKey: "applied_job_id",
            header: "Job",
            cell: ({ row }: { row: { original: T } }) => {
              const jobId = row.original.applied_job_id;
              const jobName = row.original.job_name
              if (!jobId || !jobName) return <span className="text-muted-foreground text-sm font-medium italic">N/A</span>;
              const slug = slugify(jobName);
              return (
                <div className="flex items-center gap-1.5 min-w-[120px] max-w-[200px]" title={jobName}>
                  <Link
                    to={`/dashboard/jobs/${slug}/candidates`}
                    state={{ state: { jobId: jobId } }}
                    className="text-primary font-medium hover:underline  capitalize block w-full text-wrap"
                  >
                    {jobName}
                  </Link>
                </div>
              );
            },
          } as ColumnDef<T>,
        ]
        : []),

      // 2. SCORE
      {
        id: "result",
        accessorKey: "resume_score",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold"
          >
            AI Result
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const c = row.original;
          const isProcessing =
            c.processing_status === "processing" || !c.is_parsed;

          if (isProcessing) {
            return (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-muted-foreground italic">
                    Analyzing…
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full px-2 py-0 text-[10px] uppercase font-bold w-fit tracking-wider bg-blue-500/5 text-blue-500 border-blue-200/50 animate-pulse"
                >
                  Processing
                </Badge>
              </div>
            );
          }

          const score = c.resume_score ?? null;
          if (score === null) {
            return <span className="text-muted-foreground text-sm">N/A</span>;
          }

          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{score.toFixed(1)}%</span>
                <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreColor(score, passing_threshold)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              <StatusBadge
                status={
                  c.pass_fail === null || c.pass_fail === undefined
                    ? "pending"
                    :
                    (c.pass_fail === true ||
                      String(c.pass_fail).toLowerCase() === "pass" ||
                      (c.resume_score ?? 0) >= passing_threshold)
                      ? RESUME_SCREENING_RESULT.PASS
                      : RESUME_SCREENING_RESULT.FAIL
                }
                className="rounded-full px-2 py-0 text-[10px] uppercase font-bold w-fit tracking-wider"
                mapping={{
                  [RESUME_SCREENING_RESULT.PASS]: "default",
                  [RESUME_SCREENING_RESULT.FAIL]: "destructive",
                  pending: "secondary",
                }}
              />
            </div>
          );
        },
      },
      // 4. SCREENING DECISION
      {
        id: "hr_decision",
        accessorKey: "hr_decision",
        header: "HR Decision",
        cell: ({ row }) => <HRDecisionBadge decision={row.original.hr_decision} />,
      },

      // CURRENT STAGE
      {
        id: "current_stage",
        accessorKey: "current_stage",
        header: "Stage",
        cell: ({ row }) => {
          const stage = row.original.current_stage;
          if (!stage) {
            return (
              <span className="text-muted-foreground text-sm italic font-medium">N/A</span>
            );
          }

          return (
            <div className="flex flex-col gap-1 min-w-[120px]">
              <span className="font-semibold text-sm text-foreground text-wrap max-w-[150px]" title={stage.template_name}>
                {stage.template_name}
              </span>
              <StatusBadge
                status={stage.status.replace('ed', '')}
                className="rounded-full px-2 py-0 text-[10px] uppercase font-bold w-fit tracking-wider"
              />
            </div>
          );
        },
      },

      // 5. SOCIALS
      {
        id: "socials",
        header: "Socials",
        cell: ({ row }) => {
          const { linkedin_url, github_url } = row.original;

          const getLinks = (raw: string | null | undefined) => {
            if (!raw) return [];
            return raw
              .split(";")
              .map((u) => u.trim())
              .filter((u) => isValidUrl(u));
          };

          // Combine all unique valid links from both fields
          const allLinks = Array.from(
            new Set([...getLinks(linkedin_url), ...getLinks(github_url)]),
          );

          // Separate links by type
          const liLinks = allLinks.filter((u) =>
            u.toLowerCase().includes("linkedin"),
          );
          const ghLinks = allLinks.filter((u) =>
            u.toLowerCase().includes("github"),
          );

          const renderLink = (url: string, key: string) => {
            const lowUrl = url.toLowerCase();
            const isGithub = lowUrl.includes("github");
            const isLinkedin = lowUrl.includes("linkedin");

            const type = isLinkedin ? "linkedin" : isGithub ? "github" : "other";
            const Logo =
              type === "linkedin"
                ? LinkedinLogo
                : type === "github"
                  ? GithubLogo
                  : ExternalLink;

            const linkColor =
              type === "linkedin"
                ? "text-blue-600 hover:text-blue-800"
                : type === "github"
                  ? "text-gray-900 hover:text-black dark:text-gray-200 dark:hover:text-white"
                  : "text-muted-foreground hover:text-foreground";

            return (
              <a
                key={key}
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`${capitalize(type)} Profile`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  linkColor,
                  "transition-colors",
                )}
              >
                <Logo className="h-4 w-4" />
              </a>
            );
          };

          return (
            <div className="flex items-center gap-1">
              {/* LinkedIn links */}
              {liLinks.length > 0 ? (
                liLinks.map((url, idx) => renderLink(url, `li-${idx}`))
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled
                  className="px-0 opacity-30 pointer-events-none"
                >
                  <LinkedinLogo className="h-4 w-4" />
                </Button>
              )}

              {/* GitHub links */}
              {ghLinks.length > 0 ? (
                ghLinks.map((url, idx) => renderLink(url, `gh-${idx}`))
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled
                  className="px-0 opacity-30 pointer-events-none"
                >
                  <GithubLogo className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },

      // 6. APPLIED AT
      {
        id: "applied_at",
        accessorFn: (row) => row.applied_at || row.created_at,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold"
          >
            Applied At
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = row.original.applied_at || row.original.created_at;
          if (!date)
            return <span className="text-muted-foreground text-sm">N/A</span>;
          return <DateDisplay date={date} showTime={false} />;
        },
      },

      // 7. LOCATION
      {
        id: "location",
        accessorKey: "location",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 font-semibold"
          >
            Location
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const loc = row.original.location;
          if (!loc)
            return <span className="text-muted-foreground text-sm">N/A</span>;

          // Normalize to Title Case
          const normalized = toTitleCase(loc.trim());

          const truncatedLoc = normalized.length > 20 ? `${normalized.slice(0, 18)}...` : normalized;
          return (
            <div className="flex items-center gap-1.5 text-sm" title={normalized}>
              <span>{truncatedLoc}</span>
            </div>
          );
        },
      },

      // 8. ACTIONS
      ...(renderActions
        ? [
          {
            id: "actions",
            header: () => <div className="text-right pr-2">Actions</div>,
            cell: ({ row }: { row: { original: T } }) => (
              <div className="flex items-center justify-end gap-2 pr-2">
                {renderActions(row.original)}
              </div>
            ),
          } as ColumnDef<T>,
        ]
        : []),
    ],
    [renderActions],
  );
};
