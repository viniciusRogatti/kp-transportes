import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { IInvoiceReturnItem } from '../types/types';
import { formatDateBR } from '../utils/dateDisplay';

interface BatchNote {
  invoice_number: string;
  return_type: 'total' | 'partial' | 'sobra' | 'coleta' | 'weight_break';
  items?: IInvoiceReturnItem[];
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

const groupItems = (source: IInvoiceReturnItem[]) => {
  const grouped = new Map<string, IInvoiceReturnItem>();
  source.forEach((item) => {
    const key = `${item.product_id}::${normalizeProductType(item.product_type)}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity = Number(current.quantity || 0) + Number(item.quantity || 0);
      return;
    }
    grouped.set(key, { ...item, quantity: Number(item.quantity || 0) });
  });
  return Array.from(grouped.values());
};

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

  const weightBreakNfs = notes
    .filter((note) => note.return_type === 'weight_break')
    .map((note) => note.invoice_number)
    .join(', ');

  const notesHaveItems = notes.some((note) => Array.isArray(note.items));
  const physicalItems = notesHaveItems
    ? groupItems(notes.flatMap((note) => (
      note.return_type === 'weight_break'
        ? []
        : (note.items || []).filter((item) => !item.is_missing && !item.keep_in_stock)
    )))
    : items;
  const stockItems = groupItems(notes.flatMap((note) => (
    note.return_type === 'weight_break'
      ? []
      : (note.items || []).filter((item) => !item.is_missing && item.keep_in_stock)
  )));
  const missingItems = groupItems(notes.flatMap((note) => (
    note.return_type === 'weight_break'
      ? []
      : (note.items || []).filter((item) => item.is_missing)
  )));
  const weightBreakItems = groupItems(notes.flatMap((note) => (
    note.return_type === 'weight_break' ? (note.items || []) : []
  )));

  const renderItemsTable = (sectionTitle: string, sectionItems: IInvoiceReturnItem[], emptyText?: string) => (
    <>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {sectionItems.length ? (
        <>
          <View style={styles.tableHeader}>
            <Text style={styles.colCode}>Codigo</Text>
            <Text style={styles.colDescription}>Descricao</Text>
            <Text style={styles.colQty}>Quantidade</Text>
            <Text style={styles.colType}>Tipo</Text>
          </View>
          {sectionItems.map((item, index) => (
            <View style={styles.tableRow} key={`${sectionTitle}-${item.product_id}-${normalizeProductType(item.product_type)}-${index}`}>
              <Text style={styles.colCode}>{item.product_id}</Text>
              <Text style={styles.colDescription}>{truncateText(item.product_description, 62)}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colType}>{normalizeProductType(item.product_type) || '-'}</Text>
            </View>
          ))}
        </>
      ) : (
        emptyText ? <Text style={styles.compactRow}>{emptyText}</Text> : null
      )}
    </>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Checklist de Devolucao Lote: {batchCode}</Text>
        <Text style={styles.row}>Motorista: {driverName} Placa: {vehiclePlate} Data retorno: {formatDateBR(returnDate)}</Text>

        <Text style={styles.sectionTitle}>NFs devolvidas:</Text>
        {!!totalNfs && <Text style={styles.compactRow}>total: {totalNfs}</Text>}
        {!!partialNfs && <Text style={styles.compactRow}>parcial: {partialNfs}</Text>}
        {!!collectNfs && <Text style={styles.compactRow}>coleta: {collectNfs}</Text>}
        {!!leftoverEntries && <Text style={styles.compactRow}>sobra: {leftoverEntries}</Text>}
        {!!weightBreakNfs && <Text style={styles.compactRow}>quebra de peso: {weightBreakNfs}</Text>}
        {!totalNfs && !partialNfs && !collectNfs && !leftoverEntries && !weightBreakNfs && (
          <Text style={styles.compactRow}>Nenhuma NF no lote.</Text>
        )}

        {renderItemsTable('Produtos que retornam para a MAR E RIO', physicalItems, 'Nenhum produto para retorno fisico.')}
        {!!stockItems.length && renderItemsTable('Produtos que ficarao no estoque da transportadora', stockItems)}
        {!!missingItems.length && renderItemsTable('PRODUTOS FALTANTES - NAO PROCURAR PARA SEPARACAO', missingItems)}
        {!!weightBreakItems.length && renderItemsTable('QUEBRA DE PESO - SEM RETORNO FISICO DE PRODUTO', weightBreakItems)}

        <View fixed style={styles.signatureBox}>
          <View style={styles.signatureLine} />
          <Text>Assinatura do conferente (confirmo os itens fisicamente recebidos e as excecoes identificadas acima)</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReturnReceiptPDF;
