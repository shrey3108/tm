import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Rectangle, ResponsiveContainer, Label, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CHART_COLORS } from "@/constants";
import { useIsMobile } from '@/hooks/use-mobile';
import { toTitleCase } from '@/lib/utils';

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
        // jd: {
        //     label: "AI Result",
        //     color: CHART_COLORS.criteria.jd.solid,
        // },
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
        const dataKey = entry.dataKey || entry.payload?.dataKey;
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

    const minWidth = displayData ? displayData.length * (isMobile ? 75 : 95) : 0;

    return (
        <div className="w-full custom-scrollbar overflow-y-auto animate-in fade-in zoom-in-95 duration-700">
            <div style={{ minWidth: minWidth ? `${minWidth}px` : '100%', width: '100%' }}>
                <ChartContainer config={dynamicConfig} className="w-full aspect-auto h-90 sm:h-110">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={displayData}
                            barGap={6}
                            margin={{
                                top: 20,
                                right: 20,
                                left: 30,
                                bottom: isMobile ? 45 : 55
                            }}
                            className='[&_.recharts-cartesian-grid-horizontal>line]:[stroke-dasharray:0]'
                        >
                            <Legend
                                verticalAlign="top"
                                align="right"
                                wrapperStyle={{ paddingBottom: '40px' }}
                                onClick={handleLegendClick}
                                formatter={(value, entry: any) => {
                                    const dataKey = entry.dataKey || entry.payload?.dataKey;
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
                                height={isMobile ? 75 : 85}
                                className="text-[10px] sm:text-xs font-normal text-muted-foreground"
                                tick={(props) => {
                                    const { x, y, payload } = props;
                                    if (!payload || !payload.value) return null;

                                    const value = String(payload.value);
                                    const formattedValue = toTitleCase(value);

                                    return (
                                        <g transform={`translate(${x},${y})`}>
                                            <foreignObject x={-60} y={5} width={120} height={60}>
                                                <div
                                                    className="w-full text-[10px] sm:text-xs font-normal text-muted-foreground wrap-break-word text-center leading-tight px-1"
                                                >
                                                    {formattedValue}
                                                </div>
                                            </foreignObject>
                                        </g>
                                    );
                                }}
                            >
                                <Label value="Criteria"
                                    // angle={-90}
                                    position="insideBottom"
                                    style={{ textAnchor: "middle" }}
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
                                ticks={[1, 2, 3, 4, 5]}
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
                            {/* <Bar
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
                            /> */}

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
                                        barSize={isMobile ? 20 : 40}
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
