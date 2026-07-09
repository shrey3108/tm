import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Rectangle, ResponsiveContainer, Label, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CHART_COLORS } from "@/constants";


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
        color: CHART_COLORS.criteria.jd.solid,
    },
    project: {
        label: "Project Skills",
        color: CHART_COLORS.criteria.project.solid,
    },
} satisfies ChartConfig;

const colors = {
    jd: CHART_COLORS.criteria.jd.gradient,
    project: CHART_COLORS.criteria.project.gradient,
};

export default function JobCandidatesBarChart({ isAnimationActive = true, data: chartData }: JobCandidatesAreaChartProps) {
    const [activeBar, setActiveBar] = useState<'all' | 'jd' | 'project'>('all');
    const displayData = chartData;

    const handleLegendClick = (entry: any) => {
        const dataKey = entry.dataKey || entry.payload?.dataKey || (entry.value === "JD Skills" ? "jd" : "project");
        if (dataKey === "jd" || dataKey === "project") {
            setActiveBar((prev) => (prev === dataKey ? 'all' : dataKey));
        }
    };

    const renderLabel = (props: any) => {
        const { x, y, width, value } = props;
        if (value === undefined || value === null) return null;
        return (
            <text
                x={x + (width || 0) / 2}
                y={y - 12}
                className="fill-foreground text-[10px] sm:text-xs font-bold animate-in fade-in duration-300"
                textAnchor="middle"
            >
                {value}
            </text>
        );
    };

    return (
        <div className="w-full animate-in fade-in zoom-in-95 duration-700">
            <ChartContainer config={chartConfig} className="w-full min-h-25 max-h-75">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={displayData}
                        barGap={6}
                        // margin={{ top: 20, right: 30, left: 30, bottom: 50 }}
                        className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'
                    >
                        <Legend
                            verticalAlign="top"
                            align="right"
                            wrapperStyle={{ paddingBottom: '40px' }}
                            onClick={handleLegendClick}
                            formatter={(value, entry) => {
                                const dataKey = entry.dataKey || (value === "JD Skills" ? "jd" : "project");
                                const isInactive = activeBar !== 'all' && activeBar !== dataKey;
                                return (
                                    <span
                                        className={`text-xs font-bold text-black dark:text-white cursor-pointer transition-all duration-300 select-none ${isInactive ? "line-through" : ""
                                            }`}
                                    >
                                        {value}
                                    </span>
                                );
                            }}
                        />
                        <defs>
                            <linearGradient id="gradientJd" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="0%"
                                    stopColor={colors.jd[0]}
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={colors.jd[1]}
                                    stopOpacity={1.0}
                                />
                            </linearGradient>
                            <linearGradient id="gradientProject" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="0%"
                                    stopColor={colors.project[0]}
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={colors.project[1]}
                                    stopOpacity={1.0}
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
                            content={<ChartTooltipContent />}
                        />
                        <Bar
                            dataKey="jd"
                            name="JD Skills"
                            fill="var(--color-jd)"
                            radius={[10, 10, 0, 0]}
                            barSize={50}
                            isAnimationActive={isAnimationActive}
                            animationBegin={200}
                            animationDuration={1300}
                            hide={activeBar !== 'all' && activeBar !== 'jd'}
                            label={renderLabel}
                            shape={(props: any) => {
                                const { x, y, width, height } = props;
                                return (
                                    <Rectangle
                                        x={x}
                                        y={y}
                                        width={width}
                                        height={height}
                                        radius={[10, 10, 0, 0]}
                                        fill="url(#gradientJd)"
                                        className="transition-all duration-300 hover:opacity-80"
                                    />
                                );
                            }}
                        />
                        <Bar
                            dataKey="project"
                            name="Project Skills"
                            fill="var(--color-project)"
                            radius={[10, 10, 0, 0]}
                            barSize={50}
                            isAnimationActive={isAnimationActive}
                            animationBegin={200}
                            animationDuration={1300}
                            hide={activeBar !== 'all' && activeBar !== 'project'}
                            label={renderLabel}
                            shape={(props: any) => {
                                const { x, y, width, height } = props;
                                return (
                                    <Rectangle
                                        x={x}
                                        y={y}
                                        width={width}
                                        height={height}
                                        radius={[10, 10, 0, 0]}
                                        fill="url(#gradientProject)"
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
