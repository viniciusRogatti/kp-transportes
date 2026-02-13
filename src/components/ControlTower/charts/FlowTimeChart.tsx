import ReactECharts from 'echarts-for-react';
import { DashboardCharts } from '../../../types/controlTower';
import { numberFmt } from '../format';

interface FlowTimeChartProps {
  data?: DashboardCharts;
  subtitle: string;
  onPointClick: (date: string) => void;
}

function FlowTimeChart({ data, subtitle, onPointClick }: FlowTimeChartProps) {
  const categories = data?.flowSeries.map((row) => row.date) || [];
  const confirmed = data?.flowSeries.map((row) => row.confirmed) || [];
  const requested = data?.flowSeries.map((row) => row.requested) || [];
  const completed = data?.flowSeries.map((row) => row.completed) || [];

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: 'Fluxo no tempo',
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
      data: ['Confirmadas', 'Coletas solicitadas', 'Coletas concluídas'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(2,6,23,0.95)',
      borderColor: '#1e293b',
      textStyle: { color: '#e2e8f0' },
      formatter: (params: any[]) => {
        const date = params?.[0]?.axisValue || '-';
        const lines = params
          .map((item) => `${item.marker} ${item.seriesName}: <b>${numberFmt.format(item.value)}</b> notas`)
          .join('<br/>');
        return `<div><b>${date}</b><br/>${lines}</div>`;
      },
    },
    grid: { left: 50, right: 24, top: 108, bottom: 70 },
    xAxis: {
      type: 'category',
      name: 'Data',
      nameLocation: 'middle',
      nameGap: 36,
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { show: false },
      data: categories,
    },
    yAxis: {
      type: 'value',
      name: 'Quantidade de notas',
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.15)' } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, height: 22, bottom: 14, borderColor: '#334155', backgroundColor: '#0f172a' },
    ],
    series: [
      {
        name: 'Confirmadas',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        emphasis: { focus: 'series' },
        lineStyle: { width: 2, color: '#38bdf8' },
        itemStyle: { color: '#38bdf8' },
        data: confirmed,
      },
      {
        name: 'Coletas solicitadas',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        emphasis: { focus: 'series' },
        lineStyle: { width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
        data: requested,
      },
      {
        name: 'Coletas concluídas',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        emphasis: { focus: 'series' },
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        data: completed,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 360, width: '100%' }}
      onEvents={{
        click: (params: any) => {
          if (params?.axisValue) onPointClick(params.axisValue);
        },
      }}
    />
  );
}

export default FlowTimeChart;
