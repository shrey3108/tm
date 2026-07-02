import { Pie, PieChart as RechartsPieChart, ResponsiveContainer } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { RESUME_SCREENING_RESULT, CHART_COLORS } from "@/constants";

const chartConfig = {
  pass: {
    label: RESUME_SCREENING_RESULT.PASS,
    color: CHART_COLORS.screening[RESUME_SCREENING_RESULT.PASS]
  },
  fail: {
    label: RESUME_SCREENING_RESULT.FAIL,
    color: CHART_COLORS.screening[RESUME_SCREENING_RESULT.FAIL]
  },
} satisfies ChartConfig;

interface ResultPieChartProps {
  passCount: number;
  failCount: number;
}

export function ResultPieChart({ passCount, failCount }: ResultPieChartProps) {
  const data = [
    { name: "Pass", value: passCount, fill: CHART_COLORS.screening[RESUME_SCREENING_RESULT.PASS] },
    { name: "Fail", value: failCount, fill: CHART_COLORS.screening[RESUME_SCREENING_RESULT.FAIL] },
  ].filter((item) => item.value > 0);

  const total = passCount + failCount;
  const hasData = total > 0;
  if (data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center border-2 border-dashed border-muted rounded-3xl">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground font-medium italic">No processing data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col   animate-in fade-in duration-700">
      <div className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[240px] w-[300px] px-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            {hasData ? (
              <RechartsPieChart margin={{ top: 10, bottom: 10 }}>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="value" hideLabel />}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  labelLine={false}
                  label={({ payload, ...props }) => {
                    return (
                      <text
                        cx={props.cx}
                        cy={props.cy}
                        x={props.x}
                        y={props.y}
                        textAnchor={props.textAnchor}
                        dominantBaseline={props.dominantBaseline}
                        fill="var(--foreground)"
                        className="text-xs font-bold sm:text-xs"
                      >
                        {payload.value}
                      </text>
                    );
                  }}
                />
              </RechartsPieChart>
            ) : (
              null
            )}
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <div className="flex flex-col gap-2 text-sm pt-4 items-center">
        <div className="flex flex-wrap justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.3)]"
              style={{ background: CHART_COLORS.screening[RESUME_SCREENING_RESULT.PASS] }}
            />
            <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground"> <span className="capitalize">{RESUME_SCREENING_RESULT.PASS}</span>: {passCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shadow-[0_0_8px_rgba(252,165,165,0.3)]"
              style={{ background: CHART_COLORS.screening[RESUME_SCREENING_RESULT.FAIL] }}
            />
            <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
              <span className="capitalize">{RESUME_SCREENING_RESULT.FAIL}</span>: {failCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


