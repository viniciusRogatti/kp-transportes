import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { DailyOperationReport } from '../services/dailyOperationClosingService';
import { formatDateBR, formatDateTimeBR } from '../utils/dateDisplay';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, color: '#172033' },
  title: { fontSize: 17, fontWeight: 700, marginBottom: 3 },
  subtitle: { fontSize: 8, color: '#667085', marginBottom: 12 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 5, color: '#0f766e' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  card: { width: '19%', border: '1 solid #d6dae3', borderRadius: 4, padding: 6 },
  cardLabel: { fontSize: 6.5, color: '#667085' },
  cardValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  row: { flexDirection: 'row', borderBottom: '1 solid #e4e7ec', minHeight: 20, alignItems: 'center' },
  header: { backgroundColor: '#eef6f5', fontWeight: 700 },
  cell: { padding: 4 },
  routeDriver: { width: '19%' },
  routeVehicle: { width: '18%' },
  routeCompany: { width: '18%' },
  routeNumber: { width: '9%', textAlign: 'right' },
  routeDuration: { width: '18%', textAlign: 'right' },
  pendingCompany: { width: '18%' },
  pendingInvoice: { width: '13%' },
  pendingCustomer: { width: '27%' },
  pendingCity: { width: '18%' },
  pendingStatus: { width: '14%' },
  pendingDays: { width: '10%', textAlign: 'right' },
  companyName: { width: '34%' },
  companyNumber: { width: '13.2%', textAlign: 'right' },
  notes: { border: '1 solid #d6dae3', borderRadius: 4, padding: 7, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 14, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', color: '#667085', fontSize: 6.5 },
});

const cards: Array<[keyof DailyOperationReport['summary'], string]> = [
  ['total_notes_assigned', 'Notas atribuídas'],
  ['delivered', 'Entregues'],
  ['pending_delivery', 'Pendentes de entrega'],
  ['pending_receipts', 'Canhotos pendentes'],
  ['redelivery', 'Reentregas'],
  ['returned', 'Devolvidas'],
  ['cancelled', 'Canceladas'],
  ['routes', 'Rotas'],
  ['vehicles_used', 'Veículos'],
  ['total_weight', 'Peso total (kg)'],
  ['total_boxes', 'Caixas/volumes'],
  ['loading_minutes', 'Minutos carregando'],
  ['loading_operation_minutes', 'Tempo total da operação (min)'],
  ['average_loading_minutes', 'Média por veículo (min)'],
  ['pending_route_completion', 'Rotas não concluídas'],
  ['open_occurrences', 'Ocorrências abertas'],
];

const statusLabel = (status: string) => ({
  pending: 'Sem rota', assigned: 'Atribuída', redelivery: 'Reentrega', retained: 'Retida',
}[status] || status);

export default function DailyOperationClosingPDF({ report }: { report: DailyOperationReport }) {
  return (
    <Document title={`Fechamento Operacional ${formatDateBR(report.operation_date)}`}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>Fechamento Diário da Operação</Text>
        <Text style={styles.subtitle}>
          {`${formatDateBR(report.operation_date)} · ${report.status === 'closed' ? `Fechado por ${report.closed_by_name || '-'} em ${formatDateTimeBR(report.closed_at)}` : 'Prévia ainda não fechada'}`}
        </Text>

        <View style={styles.cards}>
          {cards.map(([key, label]) => (
            <View key={key} style={styles.card}>
              <Text style={styles.cardLabel}>{label}</Text>
              <Text style={styles.cardValue}>{Number(report.summary[key] || 0).toLocaleString('pt-BR')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Resultado por empresa</Text>
          <View style={[styles.row, styles.header]}>
            <Text style={[styles.cell, styles.companyName]}>Empresa</Text>
            <Text style={[styles.cell, styles.companyNumber]}>Atribuídas</Text>
            <Text style={[styles.cell, styles.companyNumber]}>Entregues</Text>
            <Text style={[styles.cell, styles.companyNumber]}>Reentregas</Text>
            <Text style={[styles.cell, styles.companyNumber]}>Devolvidas</Text>
            <Text style={[styles.cell, styles.companyNumber]}>Pendentes</Text>
          </View>
          {report.companies.map((company) => (
            <View key={company.company_id} style={styles.row}>
              <Text style={[styles.cell, styles.companyName]}>{company.company_name}</Text>
              <Text style={[styles.cell, styles.companyNumber]}>{company.total}</Text>
              <Text style={[styles.cell, styles.companyNumber]}>{Number(company.delivered || 0) + Number(company.completed || 0) + Number(company.delivered_pending_receipt || 0)}</Text>
              <Text style={[styles.cell, styles.companyNumber]}>{company.redelivery || 0}</Text>
              <Text style={[styles.cell, styles.companyNumber]}>{company.returned || 0}</Text>
              <Text style={[styles.cell, styles.companyNumber]}>{company.pending_delivery || 0}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Carregamentos e rotas</Text>
          <Text style={styles.subtitle}>{`Início: ${report.loading_start_time || 'não informado'} · Finalização: ${report.loading_end_time || 'não informada'} · Tempo total: ${report.summary.loading_operation_minutes || 0} min · Média por veículo: ${Number(report.summary.average_loading_minutes || 0).toLocaleString('pt-BR')} min`}</Text>
          <View style={[styles.row, styles.header]} fixed>
            <Text style={[styles.cell, styles.routeDriver]}>Motorista</Text>
            <Text style={[styles.cell, styles.routeVehicle]}>Veículo</Text>
            <Text style={[styles.cell, styles.routeCompany]}>Empresa</Text>
            <Text style={[styles.cell, styles.routeNumber]}>Notas</Text>
            <Text style={[styles.cell, styles.routeNumber]}>Peso</Text>
            <Text style={[styles.cell, styles.routeNumber]}>Caixas</Text>
            <Text style={[styles.cell, styles.routeDuration]}>Carregamento</Text>
          </View>
          {report.routes.map((route) => (
            <View key={route.trip_id} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.routeDriver]}>{route.driver_name}</Text>
              <Text style={[styles.cell, styles.routeVehicle]}>{route.vehicle}</Text>
              <Text style={[styles.cell, styles.routeCompany]}>{route.company_name}</Text>
              <Text style={[styles.cell, styles.routeNumber]}>{route.total_notes}</Text>
              <Text style={[styles.cell, styles.routeNumber]}>{route.total_weight.toLocaleString('pt-BR')}</Text>
              <Text style={[styles.cell, styles.routeNumber]}>{route.total_boxes}</Text>
              <Text style={[styles.cell, styles.routeDuration]}>{route.duration_minutes ? `${route.duration_minutes} min` : 'Não informado'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section} break={report.routes.length > 14}>
          <Text style={styles.sectionTitle}>Pendências levadas para o próximo dia</Text>
          <View style={[styles.row, styles.header]} fixed>
            <Text style={[styles.cell, styles.pendingCompany]}>Empresa</Text>
            <Text style={[styles.cell, styles.pendingInvoice]}>NF</Text>
            <Text style={[styles.cell, styles.pendingCustomer]}>Cliente</Text>
            <Text style={[styles.cell, styles.pendingCity]}>Cidade</Text>
            <Text style={[styles.cell, styles.pendingStatus]}>Situação</Text>
            <Text style={[styles.cell, styles.pendingDays]}>Dias</Text>
          </View>
          {report.pending_deliveries.length ? report.pending_deliveries.map((row) => (
            <View key={`${row.company_id}-${row.invoice_number}`} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.pendingCompany]}>{row.company_name}</Text>
              <Text style={[styles.cell, styles.pendingInvoice]}>{row.invoice_number}</Text>
              <Text style={[styles.cell, styles.pendingCustomer]}>{row.customer_name}</Text>
              <Text style={[styles.cell, styles.pendingCity]}>{row.city}</Text>
              <Text style={[styles.cell, styles.pendingStatus]}>{statusLabel(row.status)}</Text>
              <Text style={[styles.cell, styles.pendingDays]}>{row.pending_days}</Text>
            </View>
          )) : <Text style={styles.notes}>Nenhuma pendência de entrega no fechamento.</Text>}
        </View>

        {report.notes ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Observações do fechamento</Text>
            <Text style={styles.notes}>{report.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{`Gerado em ${formatDateTimeBR(report.generated_at)}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
