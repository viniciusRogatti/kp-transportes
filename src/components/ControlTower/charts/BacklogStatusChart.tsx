import ReactECharts from 'echarts-for-react';
import { DashboardCharts, BacklogStatus } from '../../../types/controlTower';
import { numberFmt } from '../format';

const statusColors: Record<BacklogStatus, string> = {
  PENDENTE: '#ef4444',
  SOLICITADA: '#f59e0b',
  EM_ROTA: '#38bdf8',
  COLETADA: '#10b981',
  CANCELADA: '#64748b',
};

function BacklogStatusChart({ data, subtitle, onStatusClick }: { data?: DashboardCharts; subtitle: string; onStatusClick: (status: BacklogStatus) => void; }) {
  const statuses = data?.backlog || [];

  const option = {
    title: {
      text: 'Backlog por status',
      subtext: subtitle,
      top: 6,
      left: 12,
      textStyle: { color: '#e2e8f0', fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: '#94a3b8', fontSize: 11 },
    },
    legend: {
      top: 44,
      left: 12,
      textStyle: { color: '#cbd5e1' },
      selectedMode: true,
      data: statuses.map((item) => item.status),
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(2,6,23,0.95)',
      borderColor: '#1e293b',
      textStyle: { color: '#e2e8f0' },
      formatter: (params: any) => `${params.marker} ${params.seriesName}: <b>${numberFmt.format(params.value)}</b> lotes`,
    },
    grid: { left: 42, right: 16, top: 108, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['Backlog'],
      name: 'Categoria',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: 'Quantidade',
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.15)' } },
    },
    series: statuses.map((item) => ({
      name: item.status,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      label: { show: item.count > 0, color: '#e2e8f0', formatter: '{c}' },
      itemStyle: { color: statusColors[item.status] },
      data: [item.count],
    })),
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 280, width: '100%' }}
      onEvents={{
        click: (params: any) => {
          if (params?.seriesName) onStatusClick(params.seriesName as BacklogStatus);
        },
      }}
    />
  );
}

export default BacklogStatusChart;
