import ReactECharts from 'echarts-for-react';
import { DashboardCharts } from '../../../types/controlTower';
import { numberFmt } from '../format';

function ReasonsDonutChart({ data, subtitle, onSliceClick }: { data?: DashboardCharts; subtitle: string; onSliceClick?: (reason: string) => void }) {
  const reasons = data?.reasons || [];

  const option = {
    title: {
      text: 'Causas de devoluções',
      subtext: subtitle,
      top: 6,
      left: 12,
      textStyle: { color: 'var(--chart-title)', fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: 'var(--chart-subtitle)', fontSize: 11 },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'var(--chart-tooltip-bg)',
      borderColor: 'var(--chart-tooltip-border)',
      textStyle: { color: 'var(--chart-tooltip-text)' },
      formatter: (params: any) => `${params.marker} ${params.name}: <b>${numberFmt.format(params.value)}</b> lotes (${params.percent}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 50,
      textStyle: { color: 'var(--chart-legend-label)', fontSize: 11 },
      selectedMode: true,
    },
    series: [
      {
        name: 'Motivo',
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['36%', '60%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'var(--chart-pie-border)', borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 6 },
        label: { color: 'var(--chart-legend-label)', formatter: '{d}%' },
        labelLine: { lineStyle: { color: 'var(--chart-pie-label-line)' } },
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
