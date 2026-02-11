import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { IInvoiceReturnItem } from '../types/types';

interface BatchNote {
  invoice_number: string;
  return_type: 'total' | 'partial' | 'sobra';
}

interface ReturnReceiptPDFProps {
  batchCode: string;
  driverName: string;
  vehiclePlate: string;
  returnDate: string;
  notes: BatchNote[];
  items: IInvoiceReturnItem[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 80,
    fontSize: 11,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  row: {
    marginBottom: 2,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 3,
    fontSize: 12,
    fontWeight: 'bold',
  },
  compactRow: {
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: '#000',
    paddingVertical: 4,
    marginTop: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 3,
  },
  colCode: {
    width: '16%',
  },
  colDescription: {
    width: '64%',
    maxLines: 1,
  },
  colQty: {
    width: '20%',
    textAlign: 'right',
  },
  signatureBox: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderColor: '#000',
    marginBottom: 4,
    width: '70%',
  },
});

function truncateText(value: string | null | undefined, max = 64) {
  if (!value) return '';
  if (value.length <= max) return value;
  return value.slice(0, max);
}

const ReturnReceiptPDF: React.FC<ReturnReceiptPDFProps> = ({
  batchCode,
  driverName,
  vehiclePlate,
  returnDate,
  notes,
  items,
}) => {
  const totalNfs = notes
    .filter((note) => note.return_type === 'total')
    .map((note) => note.invoice_number)
    .join(', ');

  const partialNfs = notes
    .filter((note) => note.return_type === 'partial')
    .map((note) => note.invoice_number)
    .join(', ');

  const leftoverEntries = notes
    .filter((note) => note.return_type === 'sobra')
    .map((note) => note.invoice_number)
    .join(', ');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Checklist de Devolucao Lote: {batchCode}</Text>
        <Text style={styles.row}>Motorista: {driverName} Placa: {vehiclePlate} Data retorno: {returnDate}</Text>

        <Text style={styles.sectionTitle}>NFs devolvidas:</Text>
        {!!totalNfs && <Text style={styles.compactRow}>total: {totalNfs}</Text>}
        {!!partialNfs && <Text style={styles.compactRow}>parcial: {partialNfs}</Text>}
        {!!leftoverEntries && <Text style={styles.compactRow}>sobra: {leftoverEntries}</Text>}
        {!totalNfs && !partialNfs && !leftoverEntries && <Text style={styles.compactRow}>Nenhuma NF no lote.</Text>}

        <Text style={styles.sectionTitle}>Produtos consolidados</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colCode}>Codigo</Text>
          <Text style={styles.colDescription}>Descricao</Text>
          <Text style={styles.colQty}>Quantidade</Text>
        </View>
        {items.map((item, index) => (
          <View style={styles.tableRow} key={`${item.product_id}-${index}`}>
            <Text style={styles.colCode}>{item.product_id}</Text>
            <Text style={styles.colDescription}>{truncateText(item.product_description, 62)}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
          </View>
        ))}

        <View fixed style={styles.signatureBox}>
          <View style={styles.signatureLine} />
          <Text>Assinatura do conferente (confirmo o recebimento de todos os itens acima)</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReturnReceiptPDF;
