import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Rectangle, ResponsiveContainer, Label } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig, } from "@/components/ui/chart"
import { MAX_LOCATION_BAR_CHART_DISPLAY_LIMIT, HR_DECISION_OPTIONS } from "@/constants";
import type { JobCandidatesStatsProps } from "@/components/candidate/JobCandidatesStats";

const chartConfig = {
  value: {
    label: "Total Candidates",
    color: "#3b82f6",
  },
  approve: {
    label: HR_DECISION_OPTIONS.PASS,
    color: "hsl(var(--success))",
  },
  reject: {
    label: HR_DECISION_OPTIONS.FAIL,
    color: "hsl(var(--destructive))",
  },
  maybe: {
    label: HR_DECISION_OPTIONS.MAY_BE,
    color: "hsl(var(--warning))",
  },
  pending: {
    label: HR_DECISION_OPTIONS.PENDING,
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig

interface CandidatesDistributionChartProps {
  stats: JobCandidatesStatsProps;
}

export function CandidatesDistributionChart({ stats }: CandidatesDistributionChartProps) {
  const data = [
    // { name: "Total Candidates", value: stats.totalCandidates, gradientId: "gradientTotal" },
    { name: HR_DECISION_OPTIONS.PASS, value: stats.passedCount, gradientId: "gradientApprove" },
    { name: HR_DECISION_OPTIONS.MAY_BE, value: stats.maybeCount, gradientId: "gradientMaybe" },
    { name: HR_DECISION_OPTIONS.FAIL, value: stats.failedCount, gradientId: "gradientReject" },
    { name: HR_DECISION_OPTIONS.PENDING, value: stats.undecidedCount, gradientId: "gradientPending" },
  ];

  const colors = {
    Total: ["#93c5fd", "#60a5fa"],     // soft blue
    [HR_DECISION_OPTIONS.PASS]: ["#86efac", "#4ade80"],  // soft green
    [HR_DECISION_OPTIONS.MAY_BE]: ["#fde68a", "#fcd34d"],     // soft amber
    [HR_DECISION_OPTIONS.FAIL]: ["#fca5a5", "#f87171"],  // soft red
    [HR_DECISION_OPTIONS.PENDING]: ["#cbd5f5", "#a5b4fc"],   // soft slate/indigo
  };

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-700">
      <ChartContainer config={chartConfig} className="w-full min-h-[100px] max-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 30, bottom: 50 }}
            className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'
          >
            <defs>
              <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors.Total[0]}
                  stopOpacity={0.8}
                />
                <stop
                  offset="100%"
                  stopColor={colors.Total[1]}
                  stopOpacity={1}
                />
              </linearGradient>
              <linearGradient id="gradientApprove" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors[HR_DECISION_OPTIONS.PASS][0]}
                  stopOpacity={0.8}
                />
                <stop
                  offset="100%"
                  stopColor={colors[HR_DECISION_OPTIONS.PASS][1]}
                  stopOpacity={1}
                />
              </linearGradient>
              <linearGradient id="gradientReject" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors[HR_DECISION_OPTIONS.FAIL][0]}
                  stopOpacity={0.8}
                />
                <stop
                  offset="100%"
                  stopColor={colors[HR_DECISION_OPTIONS.FAIL][1]}
                  stopOpacity={1}
                />
              </linearGradient>
              <linearGradient id="gradientMaybe" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors[HR_DECISION_OPTIONS.MAY_BE][0]}
                  stopOpacity={0.8}
                />
                <stop
                  offset="100%"
                  stopColor={colors[HR_DECISION_OPTIONS.MAY_BE][1]}
                  stopOpacity={1}
                />
              </linearGradient>
              <linearGradient id="gradientPending" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={colors[HR_DECISION_OPTIONS.PENDING][0]}
                  stopOpacity={0.8}
                />
                <stop
                  offset="100%"
                  stopColor={colors[HR_DECISION_OPTIONS.PENDING][1]}
                  stopOpacity={1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="6 6"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={12}
              axisLine={false}
              interval={0}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              <Label
                value="Hr Decision"
                position="insideBottom"
                offset={-25}
                className="fill-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider"
              />
            </XAxis>
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              className="text-[10px] sm:text-xs font-medium text-muted-foreground"
              allowDecimals={false}
            >
              <Label
                value="No. of Candidates"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle" }}
                className="fill-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider"
              />
            </YAxis>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
              formatter={(value) => <span className="text-xs">Total Candidates : <span className="font-bold">
                {value}
              </span></span>}
            />
            <Bar
              dataKey="value"
              radius={[10, 10, 0, 0]}
              barSize={Math.min(50, 80)} // Dynamic bar size
              animationBegin={100}
              animationDuration={1500}
              animationEasing="ease-out"
              label={(props: any) => {
                const { x, y, width, value } = props;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 12}
                    className="fill-foreground text-[10px] sm:text-xs font-bold"
                    textAnchor="middle"
                  >
                    {value}
                  </text>
                );
              }}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                return (
                  <Rectangle
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    radius={[10, 10, 0, 0]}
                    fill={`url(#${payload?.gradientId})`}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

interface StagesBarChartProps {
  stages: Record<string, number>;
  onStageClick?: (stageName: string) => void;
  selectedStage?: string | null;
}

export function StagesBarChart({ stages, onStageClick, selectedStage }: StagesBarChartProps) {
  const data = Object.entries(stages)
    .map(([name, value], index) => ({
      name,
      value,
      gradientId: `gradientStage-${index}`,
    }));
  const colors = [
    ["#ddd6fe", "#c4b5fd"], // soft violet
    ["#c7d2fe", "#a5b4fc"], // soft indigo
    ["#bfdbfe", "#93c5fd"], // soft blue
    ["#a5f3fc", "#67e8f9"], // soft cyan
    ["#99f6e4", "#5eead4"], // soft teal
    ["#a7f3d0", "#6ee7b7"], // soft emerald
  ];

  if (data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center border-2 border-dashed border-muted rounded-3xl">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground font-medium italic">No stage data available yet.</p>
          <p className="text-xs text-muted-foreground/60">Upload candidates to see stage distribution.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-700">
      <ChartContainer
        config={{
          value: {
            label: "Candidates",
            color: "hsl(var(--primary))",
          },
        }}
        className="w-full min-h-[100px] max-h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 30, bottom: 50 }}
            className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'
          >
            <defs>
              {data.map((_, index) => (
                <linearGradient
                  key={`gradientStage-${index}`}
                  id={`gradientStage-${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={colors[index % colors.length][0]}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="100%"
                    stopColor={colors[index % colors.length][1]}
                    stopOpacity={1}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="6 6"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={12}
              axisLine={false}
              interval={0}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              <Label
                value="Recruitment Stages"
                position="insideBottom"
                offset={-25}
                className="fill-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider"
              />
            </XAxis>
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              className="text-[10px] sm:text-xs font-medium text-muted-foreground"
              allowDecimals={false}
            >
              <Label
                value="No. of Candidates"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle" }}
                className="fill-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider"
              />
            </YAxis>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
              formatter={(value) => (
                <span className="text-xs">
                  Candidates : <span className="font-bold">{value}</span>
                </span>
              )}
            />
            <Bar
              dataKey="value"
              radius={[10, 10, 0, 0]}
              barSize={50}
              animationBegin={100}
              animationDuration={1500}
              animationEasing="ease-out"
              cursor={onStageClick ? "pointer" : undefined}
              onClick={(data: any) => {
                if (onStageClick && data?.name) {
                  onStageClick(data.name);
                  window.scrollTo({
                    top: 400,
                    behavior: "smooth",
                  });
                }
              }}
              label={(props: any) => {
                const { x, y, width, value } = props;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 12}
                    className="fill-foreground text-[10px] sm:text-xs font-bold"
                    textAnchor="middle"
                  >
                    {value}
                  </text>
                );
              }}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                const isSelected = !selectedStage || payload?.name === selectedStage;
                return (
                  <Rectangle
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    radius={[10, 10, 0, 0]}
                    fill={`url(#${payload?.gradientId})`}
                    className="transition-all duration-300 hover:opacity-80"
                    opacity={isSelected ? 1 : 0.3}
                    style={selectedStage && payload?.name === selectedStage ? {
                      filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
                    } : undefined}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

interface LocationBarChartProps {
  locations: Record<string, number>;
}

export function LocationBarChart({ locations }: LocationBarChartProps) {
  const sortedEntries = Object.entries(locations).sort((a, b) => b[1] - a[1]);

  let displayData: [string, number][];
  if (sortedEntries.length > MAX_LOCATION_BAR_CHART_DISPLAY_LIMIT) {
    const topX = sortedEntries.slice(0, MAX_LOCATION_BAR_CHART_DISPLAY_LIMIT);
    const others = sortedEntries.slice(MAX_LOCATION_BAR_CHART_DISPLAY_LIMIT).reduce((acc, [_, val]) => acc + val, 0);
    displayData = [...topX, ["Other", others]];
  } else {
    displayData = sortedEntries;
  }

  const data = displayData.map(([name, value], index) => ({
    name,
    value,
    gradientId: `gradientLocation-${index}`,
  }));

  const colors = [
    ["#fed7aa", "#fdba74"], // soft orange
    ["#fde68a", "#fcd34d"], // soft amber
    ["#fef08a", "#fde047"], // soft yellow
    ["#fdba74", "#fb923c"], // peach
    ["#fcd34d", "#fbbf24"], // warm amber
  ];

  if (data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center border-2 border-dashed border-muted rounded-3xl">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground font-medium italic">No location data available yet.</p>
          <p className="text-xs text-muted-foreground/60">Candidate locations will appear here once extracted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-700">
      <ChartContainer
        config={{
          value: {
            label: "Candidates",
            color: "hsl(var(--primary))",
          },
        }}
        className="w-full min-h-[100px] max-h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 30, bottom: 50 }}
            className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'
          >
            <defs>
              {data.map((_, index) => (
                <linearGradient
                  key={`gradientLocation-${index}`}
                  id={`gradientLocation-${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={colors[index % colors.length][0]}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="100%"
                    stopColor={colors[index % colors.length][1]}
                    stopOpacity={1}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="6 6"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={12}
              axisLine={false}
              interval={0}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              <Label
                value="Candidate Locations"
                position="insideBottom"
                offset={-25}
                className="fill-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider"
              />
            </XAxis>
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              className="text-[10px] sm:text-xs font-medium text-muted-foreground"
              allowDecimals={false}
            >
              <Label
                value="No. of Candidates"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle" }}
                className="fill-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider"
              />
            </YAxis>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
              formatter={(value) => (
                <span className="text-xs">
                  Candidates : <span className="font-bold">{value}</span>
                </span>
              )}
            />
            <Bar
              dataKey="value"
              radius={[10, 10, 0, 0]}
              barSize={50}
              animationBegin={100}
              animationDuration={1500}
              animationEasing="ease-out"
              label={(props: any) => {
                const { x, y, width, value } = props;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 12}
                    className="fill-foreground text-[10px] sm:text-xs font-bold"
                    textAnchor="middle"
                  >
                    {value}
                  </text>
                );
              }}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                return (
                  <Rectangle
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    radius={[10, 10, 0, 0]}
                    fill={`url(#${payload?.gradientId})`}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
