import {
    Area,
    AreaChart,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    ResponsiveContainer,
} from 'recharts';

// #region Sample data
const data = [
    {
        name: 'performance',
        jd: 2.0,
        project: 3.0,
    },
    {
        name: 'arch',
        jd: 2.0,
        project: 5.0,
    },
    {
        name: 'code q',
        jd: 2.0,
        project: 2.0,
    },
    {
        name: 'correctness',
        jd: 0.0,
        project: 0.0,
    },
    {
        name: 'security',
        jd: 2.0,
        project: 2.0,
    },
    {
        name: 'doc',
        jd: 1.0,
        project: 1.0,
    },
];

// #endregion

interface ChartDataPoint {
    name: string;
    jd: number;
    project: number;
}

interface AreaChartExampleProps {
    isAnimationActive?: boolean;
    data?: ChartDataPoint[];
}

const AreaChartExample = ({ isAnimationActive = true, data: chartData }: AreaChartExampleProps) => {
    const displayData = chartData || data;
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart
                data={displayData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#86efac" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fde68a" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#fcd34d" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Area
                    type="monotone"
                    dataKey="jd"
                    name="JD Skills"
                    stroke="#86efac"
                    fillOpacity={1}
                    fill="url(#colorUv)"
                    isAnimationActive={isAnimationActive}
                    animationBegin={200}
                    animationDuration={1300}
                />
                <Area
                    type="monotone"
                    dataKey="project"
                    name="Project Skills"
                    stroke="#fde68a"
                    fillOpacity={1}
                    fill="url(#colorPv)"
                    isAnimationActive={isAnimationActive}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default AreaChartExample;

