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

type ReturnSection = {
  title: string;
  notes: BatchNote[];
  items: IInvoiceReturnItem[];
  emptyText?: string;
};

const RETURN_TYPE_LABELS: Record<BatchNote['return_type'], string> = {
  total: 'total',
  partial: 'parcial',
  sobra: 'sobra',
  coleta: 'coleta',
  weight_break: 'quebra de peso',
};

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

const groupInvoicesByReturnType = (source: BatchNote[]) => {
  const grouped = new Map<BatchNote['return_type'], string[]>();
  source.forEach((note) => {
    const invoices = grouped.get(note.return_type) || [];
    if (!invoices.includes(note.invoice_number)) invoices.push(note.invoice_number);
    grouped.set(note.return_type, invoices);
  });
  return Array.from(grouped.entries()).map(([returnType, invoices]) => ({
    label: RETURN_TYPE_LABELS[returnType],
    invoices,
  }));
};

const ReturnReceiptPDF: React.FC<ReturnReceiptPDFProps> = ({
  batchCode,
  driverName,
  vehiclePlate,
  returnDate,
  notes,
  items,
}) => {
  const notesHaveItems = notes.some((note) => Array.isArray(note.items));
  const physicalNotes = notes.filter((note) => (
    note.return_type !== 'weight_break'
    && (notesHaveItems
      ? (note.items || []).some((item) => !item.is_missing && !item.keep_in_stock)
      : true)
  ));
  const stockNotes = notes.filter((note) => (
    note.return_type !== 'weight_break'
    && (note.items || []).some((item) => !item.is_missing && item.keep_in_stock)
  ));
  const missingNotes = notes.filter((note) => (
    note.return_type !== 'weight_break'
    && (note.items || []).some((item) => item.is_missing)
  ));
  const weightBreakNotes = notes.filter((note) => note.return_type === 'weight_break');

  const sections: ReturnSection[] = [
    {
      title: 'Produtos que retornam para a MAR E RIO',
      notes: physicalNotes,
      items: notesHaveItems
        ? groupItems(physicalNotes.flatMap((note) => (note.items || []).filter((item) => !item.is_missing && !item.keep_in_stock)))
        : items,
      emptyText: 'Nenhum produto para retorno fisico.',
    },
    {
      title: 'Produtos que ficarao no estoque da transportadora',
      notes: stockNotes,
      items: groupItems(stockNotes.flatMap((note) => (note.items || []).filter((item) => !item.is_missing && item.keep_in_stock))),
    },
    {
      title: 'PRODUTOS FALTANTES - SEM RETORNO FISICO DE PRODUTO',
      notes: missingNotes,
      items: groupItems(missingNotes.flatMap((note) => (note.items || []).filter((item) => item.is_missing))),
    },
    {
      title: 'QUEBRA DE PESO - SEM RETORNO FISICO DE PRODUTO',
      notes: weightBreakNotes,
      items: groupItems(weightBreakNotes.flatMap((note) => note.items || [])),
    },
  ];

  const renderSection = ({ title, notes: sectionNotes, items: sectionItems, emptyText }: ReturnSection) => (
    <React.Fragment key={title}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {groupInvoicesByReturnType(sectionNotes).map(({ label, invoices }) => (
        <Text key={`${title}-${label}`} style={styles.compactRow}>{label}: {invoices.join(', ')}</Text>
      ))}
      {sectionItems.length ? (
        <>
          <View style={styles.tableHeader}>
            <Text style={styles.colCode}>Codigo</Text>
            <Text style={styles.colDescription}>Descricao</Text>
            <Text style={styles.colQty}>Quantidade</Text>
            <Text style={styles.colType}>Tipo</Text>
          </View>
          {sectionItems.map((item, index) => (
            <View style={styles.tableRow} key={`${title}-${item.product_id}-${normalizeProductType(item.product_type)}-${index}`}>
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
    </React.Fragment>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Checklist de Devolucao Lote: {batchCode}</Text>
        <Text style={styles.row}>Motorista: {driverName} Placa: {vehiclePlate} Data retorno: {formatDateBR(returnDate)}</Text>

        {sections
          .filter((section) => section.notes.length || section.items.length || section.emptyText)
          .map((section) => renderSection(section))}

        <View fixed style={styles.signatureBox}>
          <View style={styles.signatureLine} />
          <Text>Assinatura do conferente (confirmo os itens fisicamente recebidos e as excecoes identificadas acima)</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReturnReceiptPDF;
