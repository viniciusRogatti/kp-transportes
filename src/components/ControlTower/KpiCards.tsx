import ReactECharts from 'echarts-for-react';
import { CircleHelp } from 'lucide-react';
import Card from '../ui/Card';
import { DashboardSummary, KpiMetric } from '../../types/controlTower';
import { numberFmt } from './format';

function metricSuffix(metric: KpiMetric) {
  if (metric.unit === 'kg') return ' kg';
  if (metric.unit === 'hours') return ' h';
  return '';
}

function Sparkline({ values }: { values: number[] }) {
  const option = {
    animation: false,
    grid: { top: 2, bottom: 2, left: 2, right: 2 },
    xAxis: { type: 'category', data: values.map((_, index) => index), show: false },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#38bdf8', width: 2 },
        areaStyle: { color: 'rgba(56,189,248,0.15)' },
      },
    ],
    tooltip: { trigger: 'axis' },
  };

  return <ReactECharts option={option} style={{ height: 56, width: '100%' }} />;
}

function KpiCards({ summary }: { summary?: DashboardSummary | null }) {
  if (!summary) {
    return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Card key={index} className="h-[150px] animate-pulse border-slate-800 bg-slate-900/70" />)}</div>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {summary.metrics.map((metric) => {
        const isNegative = metric.variationPct < 0;
        return (
          <Card key={metric.id} className="border-slate-800 bg-[#101b2b] text-slate-100">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{metric.label}</p>
                <div className="mt-1 flex items-end gap-2">
                  <strong className="text-3xl font-semibold">{numberFmt.format(metric.value)}{metricSuffix(metric)}</strong>
                  <span className={`text-sm font-semibold ${isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {metric.variationPct > 0 ? '+' : ''}{metric.variationPct}%
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="group relative inline-flex items-center text-slate-400 focus:outline-none focus-visible:text-slate-200"
                aria-label={`Ajuda sobre ${metric.label}`}
              >
                <CircleHelp className="h-4 w-4" />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-6 z-20 w-64 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-left text-[11px] leading-relaxed text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100"
                >
                  {metric.helpText}
                </span>
              </button>
            </div>
            <Sparkline values={metric.sparkline} />
          </Card>
        );
      })}
    </div>
  );
}

export default KpiCards;
