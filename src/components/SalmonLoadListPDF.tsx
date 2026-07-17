import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { SalmonLoadDriverGroup } from '../utils/salmonLoadList';

interface SalmonLoadListPDFProps {
  drivers: SalmonLoadDriverGroup[];
  dateLabel: string;
}

const ROWS_PER_PAGE = 21;
const DRIVERS_PER_PAGE = 3;

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 22,
    color: '#000000',
    fontSize: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1.2,
    borderBottomColor: '#000000',
    paddingBottom: 7,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 8,
  },
  date: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  driverColumn: {
    flexGrow: 1,
    flexBasis: 0,
    marginRight: 7,
    borderWidth: 1,
    borderColor: '#000000',
  },
  lastDriverColumn: {
    marginRight: 0,
  },
  driverHeader: {
    backgroundColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  driverName: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  driverMeta: {
    marginTop: 2,
    fontSize: 7,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    minHeight: 25,
    borderBottomWidth: 0.7,
    borderBottomColor: '#6b7280',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  customerColumn: {
    width: '49%',
    paddingRight: 4,
  },
  documentColumn: {
    width: '35%',
    paddingRight: 3,
  },
  boxesColumn: {
    width: '16%',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptyColumn: {
    minHeight: 50,
    padding: 7,
  },
  totalsBlock: {
    borderTopWidth: 1.2,
    borderTopColor: '#000000',
    backgroundColor: '#f3f4f6',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tripTotal: {
    fontSize: 8,
    marginBottom: 2,
  },
  driverTotal: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.7,
    borderTopColor: '#000000',
    paddingTop: 3,
    fontSize: 7,
  },
});

const formatDocument = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value || '-';
};

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

function SalmonLoadListPDF({ drivers, dateLabel }: SalmonLoadListPDFProps) {
  const driverGroups = chunk(drivers, DRIVERS_PER_PAGE);
  const pages = driverGroups.flatMap((driverGroup) => {
    const rowChunks = driverGroup.map((driver) => chunk(driver.rows, ROWS_PER_PAGE));
    const pageCount = Math.max(...rowChunks.map((rows) => rows.length), 1);

    return Array.from({ length: pageCount }, (_, pageIndex) => ({
      drivers: driverGroup.map((driver, driverIndex) => ({
        ...driver,
        rows: rowChunks[driverIndex][pageIndex] || [],
        continuation: pageIndex > 0,
        isFinalPage: pageIndex === rowChunks[driverIndex].length - 1,
      })),
    }));
  });

  return (
    <Document title={`Lista de salmao - ${dateLabel}`}>
      {pages.map((page, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Lista de Separacao de Salmao</Text>
              <Text style={styles.subtitle}>Estimativa por faixa de peso: ate 145 kg sao 4 caixas; acima disso, 5 caixas.</Text>
            </View>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>

          <View style={styles.columns}>
            {page.drivers.map((driver, driverIndex) => (
              <View
                key={driver.driverId}
                style={[
                  styles.driverColumn,
                  driverIndex === page.drivers.length - 1 ? styles.lastDriverColumn : {},
                ]}
              >
                <View style={styles.driverHeader}>
                  <Text style={styles.driverName}>{driver.driverName}</Text>
                  <Text style={styles.driverMeta}>
                    {driver.continuation ? 'Continuacao' : `${driver.rows.length} cliente(s) nesta pagina`}
                  </Text>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={styles.customerColumn}>Cliente</Text>
                  <Text style={styles.documentColumn}>CNPJ / CPF</Text>
                  <Text style={styles.boxesColumn}>Cx.</Text>
                </View>
                {driver.rows.length ? driver.rows.map((row) => (
                  <View key={`${driver.driverId}-${row.customerDocument}-${row.customerName}`} style={styles.row} wrap={false}>
                    <Text style={styles.customerColumn}>{row.customerName}</Text>
                    <Text style={styles.documentColumn}>{formatDocument(row.customerDocument)}</Text>
                    <Text style={styles.boxesColumn}>{row.boxQuantity}</Text>
                  </View>
                )) : (
                  <View style={styles.emptyColumn}>
                    <Text>Sem outros clientes nesta pagina.</Text>
                  </View>
                )}
                {driver.isFinalPage ? (
                  <View style={styles.totalsBlock}>
                    {driver.tripBoxTotals.map((tripTotal) => (
                      <Text key={tripTotal.tripId} style={styles.tripTotal}>
                        {`Rota #${tripTotal.tripId} | saída #${tripTotal.runNumber}: ${tripTotal.boxQuantity} caixa(s)`}
                      </Text>
                    ))}
                    <Text style={styles.driverTotal}>
                      {`Total do motorista: ${driver.totalBoxQuantity} caixa(s)`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.footer} fixed>
            <Text>KP Transportes</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}

export default SalmonLoadListPDF;
