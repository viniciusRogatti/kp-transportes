import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { IInvoiceReturnItem } from '../types/types';

interface BatchNote {
  invoice_number: string;
  return_type: 'total' | 'partial' | 'sobra' | 'coleta';
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
    width: '14%',
  },
  colDescription: {
    width: '54%',
    maxLines: 1,
  },
  colQty: {
    width: '20%',
    textAlign: 'right',
  },
  colType: {
    width: '12%',
    textAlign: 'center',
  },
  signatureBox: {
    position: 'absolute',
    left: 50,
    right: 50,
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

const normalizeProductType = (value?: string | null) => String(value || '').trim().toUpperCase();

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

  const collectNfs = notes
    .filter((note) => note.return_type === 'coleta')
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
        {!!collectNfs && <Text style={styles.compactRow}>coleta: {collectNfs}</Text>}
        {!!leftoverEntries && <Text style={styles.compactRow}>sobra: {leftoverEntries}</Text>}
        {!totalNfs && !partialNfs && !collectNfs && !leftoverEntries && <Text style={styles.compactRow}>Nenhuma NF no lote.</Text>}

        <Text style={styles.sectionTitle}>Produtos consolidados</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colCode}>Codigo</Text>
          <Text style={styles.colDescription}>Descricao</Text>
          <Text style={styles.colQty}>Quantidade</Text>
          <Text style={styles.colType}>Tipo</Text>
        </View>
        {items.map((item, index) => (
          <View style={styles.tableRow} key={`${item.product_id}-${normalizeProductType(item.product_type)}-${index}`}>
            <Text style={styles.colCode}>{item.product_id}</Text>
            <Text style={styles.colDescription}>{truncateText(item.product_description, 62)}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colType}>{normalizeProductType(item.product_type) || '-'}</Text>
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
