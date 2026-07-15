import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Rectangle, ResponsiveContainer, Label, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CHART_COLORS } from "@/constants";
import { useIsMobile } from '@/hooks/use-mobile';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

export interface DbdCompareChartDataPoint {
    name: string;
    jd: number;
    project: number;
    [key: string]: any;
}

export interface AssociateBarInfo {
    key: string;
    label: string;
}

interface DbdCompareBarChartProps {
    isAnimationActive?: boolean;
    data?: DbdCompareChartDataPoint[];
    associates?: AssociateBarInfo[];
}

const colors = {
    jd: CHART_COLORS.criteria.jd.gradient,
    project: CHART_COLORS.criteria.project.gradient,
};

const DBD_COLORS = [
    { solid: "#c084fc", gradient: ["#e9d5ff", "#c084fc"] as const }, // Purple
    { solid: "#6ee7b7", gradient: ["#a7f3d0", "#6ee7b7"] as const }, // Emerald
    { solid: "#67e8f9", gradient: ["#a5f3fc", "#67e8f9"] as const }, // Cyan
    { solid: "#f472b6", gradient: ["#fbcfe8", "#f472b6"] as const }, // Pink
    { solid: "#fb923c", gradient: ["#fed7aa", "#fb923c"] as const }, // Orange
];

export default function DbdCompareBarChart({
    isAnimationActive = true,
    data: chartData,
    associates = []
}: DbdCompareBarChartProps) {
    const [activeBar, setActiveBar] = useState<string>('all');
    const displayData = chartData;
    const isMobile = useIsMobile()
    // Dynamically build Recharts chart config for the legend and tooltips
    const dynamicConfig = {
        jd: {
            label: "AI Result",
            color: CHART_COLORS.criteria.jd.solid,
        },
        ...associates.reduce((acc, assoc, index) => {
            const colorInfo = DBD_COLORS[index % DBD_COLORS.length];
            acc[assoc.key] = {
                label: assoc.label,
                color: colorInfo.solid,
            };
            return acc;
        }, {} as Record<string, { label: string; color: string }>)
    } satisfies ChartConfig;

    const handleLegendClick = (entry: any) => {
        const dataKey = entry.dataKey || entry.payload?.dataKey || (entry.value === "AI Result" ? "jd" : null);
        if (dataKey) {
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

    const minWidth = displayData ? displayData.length * (isMobile ? 50 : 65) : 0;

    return (
        <div className="w-full overflow-x-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-700">
            <div style={{ minWidth: minWidth ? `${minWidth}px` : '100%', width: '100%' }}>
                <ChartContainer config={dynamicConfig} className="w-full aspect-auto h-[360px] sm:h-[440px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                        data={displayData}
                        barGap={6}
                        margin={{
                            top: 20,
                            right: 20,
                            left: 30,
                            bottom: isMobile ? 110 : 130
                        }}
                        className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'
                    >
                        <Legend
                            verticalAlign="top"
                            align="right"
                            wrapperStyle={{ paddingBottom: '40px' }}
                            onClick={handleLegendClick}
                            formatter={(value, entry) => {
                                const dataKey = entry.dataKey || (value === "AI Result" ? "jd" : value === "Project Skills" ? "project" : null);
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
                            {associates.map((assoc, index) => {
                                const colorInfo = DBD_COLORS[index % DBD_COLORS.length];
                                const gradientId = `gradientDbd_${assoc.key}`;
                                return (
                                    <linearGradient key={assoc.key} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop
                                            offset="0%"
                                            stopColor={colorInfo.gradient[0]}
                                            stopOpacity={0.8}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor={colorInfo.gradient[1]}
                                            stopOpacity={1.0}
                                        />
                                    </linearGradient>
                                );
                            })}
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
                            tick={(props) => {
                                const { x, y, payload } = props;
                                const maxLength = isMobile ? 15 : 20;
                                const truncatedValue = payload.value.length > maxLength
                                    ? payload.value.substring(0, maxLength - 3) + "..."
                                    : payload.value;
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
                                                    className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground"
                                                >
                                                    {truncatedValue}
                                                </text>
                                            </HoverCardTrigger>
                                            <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                                                <p className="text-xs">{payload.value}</p>
                                            </HoverCardContent>
                                        </HoverCard>
                                    </g>
                                );
                            }}
                        >
                            <Label
                                value="Criteria / Skills"
                                position="insideBottom"
                                offset={isMobile ? -85 : -105}
                                className="fill-muted-foreground text-[10px] sm:text-xs font-bold tracking-wider"
                            />
                        </XAxis>
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={12}
                            className="text-[10px] sm:text-xs font-medium text-muted-foreground"
                            allowDecimals={false}
                            domain={[0, 5]}
                            ticks={[0, 1, 2, 3, 4, 5]}
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
                            name="AI Result"
                            fill="var(--color-jd)"
                            radius={[10, 10, 0, 0]}
                            barSize={isMobile ? 30 : 50}
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

                        {associates.map((assoc) => {
                            // const colorInfo = DBD_COLORS[index % DBD_COLORS.length];
                            const gradientId = `gradientDbd_${assoc.key}`;
                            return (
                                <Bar
                                    key={assoc.key}
                                    dataKey={assoc.key}
                                    name={assoc.label}
                                    fill={`var(--color-${assoc.key})`}
                                    radius={[10, 10, 0, 0]}
                                    barSize={isMobile ? 30 : 50}
                                    isAnimationActive={isAnimationActive}
                                    animationBegin={200}
                                    animationDuration={1300}
                                    hide={activeBar !== 'all' && activeBar !== assoc.key}
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
                                                fill={`url(#${gradientId})`}
                                                className="transition-all duration-300 hover:opacity-80"
                                            />
                                        );
                                    }}
                                />
                            );
                        })}
                    </BarChart>
                </ResponsiveContainer>
            </ChartContainer>
            </div>
        </div>
    );
}
