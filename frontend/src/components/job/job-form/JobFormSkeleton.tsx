import { Skeleton } from "@/components/ui/skeleton";

export const JobFormSkeleton = () => (
  <div className="mx-auto w-full max-w-4xl space-y-8 animate-pulse">
    <div className="space-y-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
    <div className="h-48 w-full rounded-2xl border border-muted-foreground/10 bg-muted/5" />
    <div className="h-64 w-full rounded-2xl border border-muted-foreground/10 bg-muted/5" />
  </div>
);
