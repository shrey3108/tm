export interface JobCandidatesStatsProps {
  totalCandidates: number;
  passedCount: number;
  failedCount: number;
  maybeCount: number;
  undecidedCount: number;
}

export const JobCandidatesStats = ({
  totalCandidates,
  passedCount,
  failedCount,
  maybeCount,
  undecidedCount,
}: JobCandidatesStatsProps) => {
  const stats = [
    {
      label: "Total Candidates",
      value: totalCandidates,
      activeColor: "text-foreground",
      labelColor: "text-muted-foreground group-hover:text-foreground",
      hoverBg: "hover:bg-card/50",
      hoverBorder: "border-muted-foreground/10",
    },
    {
      label: "HR Pass",
      value: passedCount,
      activeColor: "text-green-600",
      labelColor: "text-green-600/70 group-hover:text-green-600",
      hoverBg: "hover:bg-green-500/5",
      hoverBorder: "hover:border-green-500/20",
    },
    {
      label: "HR Fail",
      value: failedCount,
      activeColor: "text-red-600",
      labelColor: "text-red-500/50 group-hover:text-red-500/80",
      hoverBg: "hover:bg-red-500/5",
      hoverBorder: "hover:border-red-500/20",
    },
    {
      label: "HR Maybe",
      value: maybeCount,
      activeColor: "text-amber-600",
      labelColor: "text-amber-600/70 group-hover:text-amber-600",
      hoverBg: "hover:bg-amber-500/5",
      hoverBorder: "hover:border-amber-500/20",
    },
    {
      label: "HR Pending",
      value: undecidedCount,
      activeColor: "text-slate-600",
      labelColor: "text-slate-600/70 group-hover:text-slate-600",
      hoverBg: "hover:bg-slate-500/5",
      hoverBorder: "hover:border-slate-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`group ${index === 0 ? "p-1" : "p-1"
            } rounded-lg border bg-card/30 backdrop-blur-sm shadow-sm flex flex-col items-center gap-1.5 transition-all duration-300 border-muted-foreground/10 ${stat.hoverBg
            } ${stat.hoverBorder}`}
        >
          <span className={`text-3xl font-black ${stat.activeColor}`}>
            {stat.value}
          </span>
          <span
            className={`text-sm font-bold transition-colors ${stat.labelColor}`}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
};
