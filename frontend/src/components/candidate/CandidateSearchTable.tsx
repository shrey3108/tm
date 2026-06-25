/**
 * CandidateSearchTable — thin wrapper around the unified CandidateTable.
 *
 * Retains server-side pagination support for the admin candidate search page
 * while using the same column layout as the dashboard JobCandidates view.
 */
import { type ReactElement } from "react";
import type { CandidateResponse } from "@/types/resume";
import type { PaginationState, OnChangeFn } from "@tanstack/react-table";
import CandidateTable from "@/components/candidate/CandidateTable";
import type { CandidateActiveFilters } from "@/hooks/useCandidateTableFilters";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";
import { Info } from "lucide-react";

interface CandidateSearchTableProps {
  candidates: CandidateResponse[];
  total: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  onShowMore: (candidate: CandidateResponse) => void;
  nameFilter?: string;
  onNameFilterChange?: (value: string) => void;
  showJobContext?: boolean;
  onFiltersChange?: (filters: CandidateActiveFilters) => void;
  // onShowAnalysisDetails: (candidate: CandidateResponse) => void;
  onDelete: (candidate: CandidateResponse) => void;
}

const CandidateSearchTable = ({
  candidates,
  total,
  pagination,
  onPaginationChange,
  onShowMore,
  nameFilter,
  onNameFilterChange,
  showJobContext = false,
  onFiltersChange,
  // onDelete
}: CandidateSearchTableProps): ReactElement => {
  return (
    <CandidateTable
      candidates={candidates}
      total={total}
      isServerSide={true}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      pageCount={Math.ceil(total / pagination.pageSize)}
      nameFilter={nameFilter}
      onNameFilterChange={onNameFilterChange}
      showJobContext={showJobContext}
      onFiltersChange={onFiltersChange}
      renderActions={(candidate) => (
        <div className="flex items-center gap-2">
          <HoverCard>
            <HoverCardTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-xl border border-muted-foreground/10 hover:bg-muted transition-all duration-300 flex items-center justify-center shrink-0"
                  onClick={() => onShowMore(candidate)}
                >
                  <Info className="h-4 w-4 shrink-0" />
                </Button>
              )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
              <div className="text-xs">Candidate Info</div>
            </HoverCardContent>
          </HoverCard>
          {/* <HoverCard>
            <HoverCardTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-xl border border-muted-foreground/10 hover:bg-muted transition-all duration-300 flex items-center justify-center shrink-0"
                  onClick={() => onDelete(candidate)}
                >
                  <Trash className="h-4 w-4 shrink-0" />
                </Button>
              )}
            />
            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
              <div className="text-xs">Delete</div>
            </HoverCardContent>
          </HoverCard> */}
        </div>
      )}
    />
  );
};

export default CandidateSearchTable;
