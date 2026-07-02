import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Label } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";


interface ChartDataPoint {
    name: string;
    jd: number;
    project: number;
}

interface JobCandidatesAreaChartProps {
    isAnimationActive?: boolean;
    data?: ChartDataPoint[];
}

const chartConfig = {
    jd: {
        label: "JD Skills",
        color: "#4ade80", // soft green
    },
    project: {
        label: "Project Skills",
        color: "#fcd34d", // soft amber
    },
} satisfies ChartConfig;

const colors = {
    jd: ["#86efac", "#4ade80"],      // soft green
    project: ["#fde68a", "#fcd34d"], // soft amber
};

export default function JobCandidatesAreaChart({ isAnimationActive = true, data: chartData }: JobCandidatesAreaChartProps) {
    const displayData = chartData;
    return (
        <div className="w-full h-full animate-in fade-in zoom-in-95 duration-700">
            <ChartContainer config={chartConfig} className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={displayData}
                        margin={{ top: 20, right: 20, left: 30, bottom: 50 }}
                        className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'
                    >
                        <defs>
                            <linearGradient id="gradientJd" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="0%"
                                    stopColor={colors.jd[0]}
                                    stopOpacity={0.4}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={colors.jd[1]}
                                    stopOpacity={0.0}
                                />
                            </linearGradient>
                            <linearGradient id="gradientProject" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="0%"
                                    stopColor={colors.project[0]}
                                    stopOpacity={0.4}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={colors.project[1]}
                                    stopOpacity={0.0}
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
                            className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground"
                        >
                            <Label
                                value="Criteria"
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
                            domain={[0, 5]}
                        >
                            <Label value="Scores"
                                angle={-90}
                                position="insideLeft"
                                style={{ textAnchor: "middle" }}
                                className="fill-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider"

                            />
                        </YAxis>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent />
                            }
                        />
                        <Area
                            type="monotone"
                            dataKey="jd"
                            name="JD Skills"
                            stroke="#4ade80"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gradientJd)"
                            isAnimationActive={isAnimationActive}
                            animationBegin={200}
                            animationDuration={1300}
                        />
                        <Area
                            type="monotone"
                            dataKey="project"
                            name="Project Skills"
                            stroke="#fcd34d"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gradientProject)"
                            isAnimationActive={isAnimationActive}
                            animationBegin={200}
                            animationDuration={1300}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartContainer>
        </div>
    );
};



