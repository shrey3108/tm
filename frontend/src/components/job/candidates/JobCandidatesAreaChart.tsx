import { useState } from 'react';
import { CartesianGrid, XAxis, YAxis, ResponsiveContainer, Label, Legend, LineChart, Line } from 'recharts';
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

export default function JobCandidatesLineChart({ isAnimationActive = true, data: chartData }: JobCandidatesAreaChartProps) {
    const [activeLine, setActiveLine] = useState<'all' | 'jd' | 'project'>('all');
    const displayData = chartData;

    const handleLegendClick = (entry: any) => {
        const dataKey = entry.dataKey || entry.payload?.dataKey || (entry.value === "JD Skills" ? "jd" : "project");
        if (dataKey === "jd" || dataKey === "project") {
            setActiveLine((prev) => (prev === dataKey ? 'all' : dataKey));
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
        <div className="w-full h-full animate-in fade-in zoom-in-95 duration-700">
            <ChartContainer config={chartConfig} className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={displayData}
                        margin={{ top: 20, right: 20, left: 30, bottom: 50 }}
                        className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'

                    >
                        <Legend
                            verticalAlign="top"
                            align="right"
                            wrapperStyle={{ paddingBottom: '10px' }}
                            onClick={handleLegendClick}
                            formatter={(value, entry) => {
                                const dataKey = entry.dataKey || (value === "JD Skills" ? "jd" : "project");
                                const isInactive = activeLine !== 'all' && activeLine !== dataKey;
                                return (
                                    <span
                                        className={`text-xs font-semibold cursor-pointer transition-all duration-300 select-none ${isInactive ? "opacity-30 line-through text-muted-foreground" : "opacity-100 font-bold"
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
                            content={<ChartTooltipContent />}
                        />
                        <Line
                            type="linear"
                            dataKey="jd"
                            name="JD Skills"
                            stroke={CHART_COLORS.criteria.jd.solid}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gradientJd)"
                            isAnimationActive={isAnimationActive}
                            animationBegin={200}
                            animationDuration={1300}
                            hide={activeLine !== 'all' && activeLine !== 'jd'}
                            label={renderLabel}
                        />
                        <Line
                            type="linear"
                            dataKey="project"
                            name="Project Skills"
                            stroke={CHART_COLORS.criteria.project.solid}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gradientProject)"
                            isAnimationActive={isAnimationActive}
                            animationBegin={200}
                            animationDuration={1300}
                            hide={activeLine !== 'all' && activeLine !== 'project'}
                            label={renderLabel}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </ChartContainer>
        </div>
    );
};
