import ReactECharts from 'echarts-for-react';
import { DashboardCharts } from '../../../types/controlTower';
import { currencyFmt, decimalFmt, numberFmt } from '../format';
import { useTheme } from '../../../context/ThemeContext';

export type TopMetric = 'quantity' | 'weightKg' | 'valueAmount';

interface TopHorizontalChartProps {
  title: string;
  subtitle: string;
  data: DashboardCharts['topProducts'] | DashboardCharts['topClients'];
  metric: TopMetric;
  color: string;
  onBarClick?: (name: string) => void;
}

const CHART_THEME = {
  light: {
    title: '#0f172a',
    subtitle: '#475569',
    axisLabel: '#475569',
    axisLine: '#94a3b8',
    gridLine: 'rgba(148, 163, 184, 0.24)',
    legendLabel: '#334155',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: '#cbd5e1',
    tooltipText: '#0f172a',
  },
  dark: {
    title: '#e2e8f0',
    subtitle: '#94a3b8',
    axisLabel: '#94a3b8',
    axisLine: '#334155',
    gridLine: 'rgba(148, 163, 184, 0.15)',
    legendLabel: '#cbd5e1',
    tooltipBg: 'rgba(2, 6, 23, 0.95)',
    tooltipBorder: '#1e293b',
    tooltipText: '#e2e8f0',
  },
} as const;

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
  const { isLightTheme } = useTheme();
  const palette = isLightTheme ? CHART_THEME.light : CHART_THEME.dark;
  const names = data.map((item) => item.name);
  const values = data.map((item) => item[metric]);

  const option = {
    title: {
      text: title,
      subtext: subtitle,
      top: 6,
      left: 12,
      textStyle: { color: palette.title, fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: palette.subtitle, fontSize: 11 },
    },
    legend: {
      top: 44,
      left: 12,
      data: [metricLabel(metric)],
      textStyle: { color: palette.legendLabel },
      selectedMode: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      formatter: (params: any[]) => {
        const item = params?.[0];
        return `${item?.name}<br/>${item?.marker} ${metricLabel(metric)}: <b>${formatValue(metric, Number(item?.value || 0))}</b>`;
      },
    },
    grid: { left: 120, right: 20, top: 108, bottom: 30 },
    xAxis: {
      type: 'value',
      name: metricLabel(metric),
      axisLabel: { color: palette.axisLabel },
      axisLine: { lineStyle: { color: palette.axisLine } },
      splitLine: { lineStyle: { color: palette.gridLine } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: palette.legendLabel },
      axisLine: { lineStyle: { color: palette.axisLine } },
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
