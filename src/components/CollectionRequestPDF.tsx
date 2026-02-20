import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ICollectionRequest } from '../types/types';
import { formatDateBR } from '../utils/dateDisplay';

interface CollectionRequestPDFProps {
  request: ICollectionRequest;
  addressLine: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 11,
    lineHeight: 1.35,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  row: {
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#111',
    paddingVertical: 4,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#d4d4d4',
    paddingVertical: 4,
  },
  colCode: {
    width: '22%',
  },
  colDescription: {
    width: '56%',
  },
  colQty: {
    width: '22%',
    textAlign: 'right',
  },
});

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function formatDateTime(value: unknown) {
  return formatDateBR(value);
}

const CollectionRequestPDF: React.FC<CollectionRequestPDFProps> = ({ request, addressLine }) => {
  const quantity = Number(request.quantity || 0);
  const productType = normalizeUpper(request.product_type);
  const notes = normalizeText(request.notes) || 'Sem observacoes';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Solicitação de coleta</Text>

        <View style={styles.section}>
          <Text style={styles.row}>NF: {normalizeText(request.invoice_number) || '-'}</Text>
          <Text style={styles.row}>Cliente: {normalizeText(request.customer_name) || '-'}</Text>
          <Text style={styles.row}>Cidade: {normalizeText(request.city) || '-'}</Text>
          <Text style={styles.row}>Endereço: {addressLine || '-'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens da coleta</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colCode}>Código</Text>
            <Text style={styles.colDescription}>Descrição</Text>
            <Text style={styles.colQty}>Quantidade</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colCode}>{normalizeText(request.product_id) || '-'}</Text>
            <Text style={styles.colDescription}>{normalizeText(request.product_description) || '-'}</Text>
            <Text style={styles.colQty}>{`${quantity}${productType}`}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observações</Text>
          <Text>{notes}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.row}>Solicitado por: {normalizeText(request.requested_by_company) || '-'}</Text>
          <Text style={styles.row}>Criado em: {formatDateTime(request.created_at)}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default CollectionRequestPDF;
