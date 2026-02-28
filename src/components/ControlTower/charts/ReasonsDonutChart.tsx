import ReactECharts from 'echarts-for-react';
import { DashboardCharts } from '../../../types/controlTower';
import { numberFmt } from '../format';
import { useTheme } from '../../../context/ThemeContext';

const CHART_THEME = {
  light: {
    title: '#0f172a',
    subtitle: '#475569',
    legendLabel: '#334155',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: '#cbd5e1',
    tooltipText: '#0f172a',
    pieBorder: '#f8fafc',
    pieLabelLine: '#64748b',
  },
  dark: {
    title: '#e2e8f0',
    subtitle: '#94a3b8',
    legendLabel: '#cbd5e1',
    tooltipBg: 'rgba(2, 6, 23, 0.95)',
    tooltipBorder: '#1e293b',
    tooltipText: '#e2e8f0',
    pieBorder: '#0f172a',
    pieLabelLine: '#64748b',
  },
} as const;

function ReasonsDonutChart({ data, subtitle, onSliceClick }: { data?: DashboardCharts; subtitle: string; onSliceClick?: (reason: string) => void }) {
  const { isLightTheme } = useTheme();
  const palette = isLightTheme ? CHART_THEME.light : CHART_THEME.dark;
  const reasons = data?.reasons || [];

  const option = {
    title: {
      text: 'Causas de devoluções',
      subtext: subtitle,
      top: 6,
      left: 12,
      textStyle: { color: palette.title, fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: palette.subtitle, fontSize: 11 },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      formatter: (params: any) => `${params.marker} ${params.name}: <b>${numberFmt.format(params.value)}</b> lotes (${params.percent}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 50,
      textStyle: { color: palette.legendLabel, fontSize: 11 },
      selectedMode: true,
    },
    series: [
      {
        name: 'Motivo',
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['36%', '60%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: palette.pieBorder, borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 6 },
        label: { color: palette.legendLabel, formatter: '{d}%' },
        labelLine: { lineStyle: { color: palette.pieLabelLine } },
        data: reasons.map((item) => ({ name: item.reason, value: item.count })),
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 290, width: '100%' }}
      onEvents={{
        click: (params: any) => {
          if (params?.name && onSliceClick) onSliceClick(params.name);
        },
      }}
    />
  );
}

export default ReasonsDonutChart;
