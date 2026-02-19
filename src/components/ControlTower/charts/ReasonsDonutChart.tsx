import ReactECharts from 'echarts-for-react';
import { DashboardCharts } from '../../../types/controlTower';
import { numberFmt } from '../format';

function ReasonsDonutChart({ data, subtitle, onSliceClick }: { data?: DashboardCharts; subtitle: string; onSliceClick?: (reason: string) => void }) {
  const reasons = data?.reasons || [];

  const option = {
    title: {
      text: 'Causas de devolução',
      subtext: subtitle,
      top: 6,
      left: 12,
      textStyle: { color: '#e2e8f0', fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: '#94a3b8', fontSize: 11 },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(2,6,23,0.95)',
      borderColor: '#1e293b',
      textStyle: { color: '#e2e8f0' },
      formatter: (params: any) => `${params.marker} ${params.name}: <b>${numberFmt.format(params.value)}</b> lotes (${params.percent}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 50,
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      selectedMode: true,
    },
    series: [
      {
        name: 'Motivo',
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['36%', '60%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#0f172a', borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 6 },
        label: { color: '#cbd5e1', formatter: '{d}%' },
        labelLine: { lineStyle: { color: '#64748b' } },
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
