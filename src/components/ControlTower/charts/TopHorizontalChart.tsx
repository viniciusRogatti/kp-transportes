import ReactECharts from 'echarts-for-react';
import { DashboardCharts } from '../../../types/controlTower';
import { currencyFmt, decimalFmt, numberFmt } from '../format';

export type TopMetric = 'quantity' | 'weightKg' | 'valueAmount';

interface TopHorizontalChartProps {
  title: string;
  subtitle: string;
  data: DashboardCharts['topProducts'] | DashboardCharts['topClients'];
  metric: TopMetric;
  color: string;
  onBarClick?: (name: string) => void;
}

function formatValue(metric: TopMetric, value: number) {
  if (metric === 'weightKg') return `${decimalFmt.format(value)} kg`;
  if (metric === 'valueAmount') return currencyFmt.format(value);
  return numberFmt.format(value);
}

function metricLabel(metric: TopMetric) {
  if (metric === 'weightKg') return 'Peso (kg)';
  if (metric === 'valueAmount') return 'Valor (R$)';
  return 'Quantidade';
}

function TopHorizontalChart({ title, subtitle, data, metric, color, onBarClick }: TopHorizontalChartProps) {
  const names = data.map((item) => item.name);
  const values = data.map((item) => item[metric]);

  const option = {
    title: {
      text: title,
      subtext: subtitle,
      top: 6,
      left: 12,
      textStyle: { color: 'var(--chart-title)', fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: 'var(--chart-subtitle)', fontSize: 11 },
    },
    legend: {
      top: 44,
      left: 12,
      data: [metricLabel(metric)],
      textStyle: { color: 'var(--chart-legend-label)' },
      selectedMode: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'var(--chart-tooltip-bg)',
      borderColor: 'var(--chart-tooltip-border)',
      textStyle: { color: 'var(--chart-tooltip-text)' },
      formatter: (params: any[]) => {
        const item = params?.[0];
        return `${item?.name}<br/>${item?.marker} ${metricLabel(metric)}: <b>${formatValue(metric, Number(item?.value || 0))}</b>`;
      },
    },
    grid: { left: 120, right: 20, top: 108, bottom: 30 },
    xAxis: {
      type: 'value',
      name: metricLabel(metric),
      axisLabel: { color: 'var(--chart-axis-label)' },
      axisLine: { lineStyle: { color: 'var(--chart-axis-line)' } },
      splitLine: { lineStyle: { color: 'var(--chart-grid-line)' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: 'var(--chart-legend-label)' },
      axisLine: { lineStyle: { color: 'var(--chart-axis-line)' } },
    },
    series: [
      {
        name: metricLabel(metric),
        type: 'bar',
        data: values,
        itemStyle: { color },
        barWidth: 16,
        emphasis: { focus: 'series' },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 290, width: '100%' }}
      onEvents={{
        click: (params: any) => {
          if (params?.name && onBarClick) onBarClick(params.name);
        },
      }}
    />
  );
}

export default TopHorizontalChart;
