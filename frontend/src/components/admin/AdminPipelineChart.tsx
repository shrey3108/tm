import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Label } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobPipelineStats } from "@/types/admin";
import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

interface StageCentricChartProps {
  data: JobPipelineStats[];
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string | number;
  payload: any;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  activeKey?: string | null;
}
/**
 * Custom tooltip component for the chart.
 * Displays only jobs with value > 0 and highlights the hovered job bar.
 * @param active - Whether the tooltip is active (visible)
 * @param payload - The data payload for the tooltip
 * @param label - The label for the tooltip (stage name)
 * @param activeKey - The key of the currently active/hovered job
 * @returns The tooltip JSX or null if not active
 */
const CustomTooltipContent = ({ active, payload, label, activeKey }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  // only show jobs with value > 0 and reverse to match stacked bar order
  const filteredPayload = [...payload].filter((entry) => entry.value > 0).reverse();

  // if no jobs with value > 0, return null
  if (filteredPayload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-card dark:border-border/50 p-3 rounded-xl shadow-md border border-border/50 max-h-[380px] overflow-y-auto pointer-events-auto ">
      <p className="font-semibold mb-2 text-sm text-foreground dark:text-white">{label}</p>

      {filteredPayload.map((entry, index) => {
        const isActive = entry.dataKey === activeKey;

        return (
          <div
            key={index}
            className={cn(
              "flex justify-between items-center px-2 py-1.5 text-xs transition-colors gap-4",
              isActive ? " font-semibold " : ""
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="capitalize max-w-[120px]">{entry.name}</span>
            </div>
            <span className="font-mono">{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
};

interface StageJob {
  stage: string;
  [jobName: string]: string | number;
}


/**
 * StageCentricChart component displays a stacked bar chart showing candidate distribution
 * across pipeline stages by job title.
 * @param data - Array of job pipeline statistics
 * @returns A card component containing the interactive bar chart
 */
export function StageCentricChart({ data }: StageCentricChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Extract job names from the last element and filter chart data
  const { chartData, jobNames } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], jobNames: [] };

    const lastItem = data[data.length - 1];
    const names = lastItem.job_names || [];
    const filteredData = data.filter(item => item.stage);

    return { chartData: filteredData, jobNames: names };
  }, [data]);
  // console.log(chartData);


  const cleanData = useMemo(() => chartData.reduce<StageJob[]>((acc, jobData) => {
    // job with non zero candidates
    const validEnt = Object.entries(jobData).filter(
      ([key, value]) => key === "stage" || (value as number) > 0,
    );

    // if stage has more then 0 cand. then stage entry in validEnt
    if (validEnt.length > 1) {
      const ob = Object.fromEntries(validEnt);
      acc.push(ob as StageJob);
    }

    return acc;
  }, [])
    , [chartData]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    const colors = [
      "hsl(210, 80%, 85%)", // Soft Blue
      "hsl(150, 60%, 85%)", // Soft Green
      "hsl(280, 65%, 88%)", // Soft Purple
      "hsl(340, 70%, 90%)", // Soft Rose
      "hsl(40, 80%, 85%)",  // Soft Amber
      "hsl(180, 50%, 85%)", // Soft Teal
    ];

    jobNames.forEach((name, index) => {
      const safeKey = name.replace(/[^a-zA-Z0-9]/g, "_");
      config[safeKey] = {
        label: name,
        color: colors[index % colors.length],
      };
    });
    return config;
  }, [jobNames]);


  if (!chartData || chartData.length === 0) {
    return (
      <Card className="shadow-xs border-0">
        <CardHeader>
          <CardTitle>Stages - Job Distribution</CardTitle>
          <CardDescription>No data available to display</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-xs border-0">
      <CardHeader>
        <CardTitle>Stages - Job Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="max-h-[350px] w-full">
          <BarChart
            data={cleanData}
            accessibilityLayer
            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="2 2" stroke="var(--muted-foreground)" strokeOpacity={0.5} />
            <XAxis
              dataKey="stage"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={(props) => {
                const { x, y, payload } = props;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <HoverCard >
                      <HoverCardTrigger delay={0} closeDelay={0}>
                        <text
                          x={0}
                          y={0}
                          dy={14}
                          textAnchor="end"
                          fill="currentColor"
                          transform="rotate(-45)"
                          className="text-xs"
                        >
                          {payload.value.length > 15 ? payload.value.substring(0, 12) + "..." : payload.value}
                        </text>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-auto p-2 bg-popover/90 backdrop-blur-sm border-primary/20 shadow-xl" side="top">
                        <p className="text-xs font-bold uppercase text-foreground">{payload.value}</p>
                      </HoverCardContent>
                    </HoverCard>
                  </g>
                );
              }}
            >
              <Label
                value="Job Stages"
                position="insideBottom"
                offset={-75}
                className="fill-muted-foreground text-[10px] sm:text-xs font-bold tracking-wider"
              />
            </XAxis>
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
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
            {/* <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} cursor={{ fill: "hsl(var(--muted)/0.2)" }} /> */}
            <ChartTooltip
              content={<CustomTooltipContent activeKey={activeKey} />}
              cursor={{ fill: "hsl(var(--muted)/0.2)" }}
              position={{
                y: -30,
              }}
              wrapperStyle={{ pointerEvents: "auto" }}
            />

            {/* <ChartLegend content={<ChartLegendContent />} /> */}
            {jobNames.map((name) => {
              const safeKey = name.replace(/[^a-zA-Z0-9]/g, "_");
              return (
                <Bar
                  key={name}
                  dataKey={name}
                  name={name}
                  stackId="a"
                  fill={chartConfig[safeKey]?.color}
                  radius={[0, 0, 0, 0]}
                  onMouseEnter={() => { setActiveKey(name) }}
                  onMouseLeave={() => setActiveKey(null)}
                >
                </Bar>
              );
            })}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}


export default StageCentricChart;