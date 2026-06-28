import { Skeleton } from "@/components/ui/skeleton";

interface JobCandidatesSkeletonProps {
  count?: number;
}

export const JobCandidatesSkeleton = ({ count = 5 }: JobCandidatesSkeletonProps) => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="border rounded-2xl p-4 bg-background/30 animate-pulse border-muted-foreground/10 mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-4 w-60 rounded" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);
