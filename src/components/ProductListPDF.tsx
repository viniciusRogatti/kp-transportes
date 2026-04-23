import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { IDanfe } from '../types/types';
import { formatDateBR } from '../utils/dateDisplay';

interface ProductRow {
  Product?: {
    code?: string;
    description?: string;
    type?: string;
  };
  code?: string;
  description?: string;
  type?: string;
  quantity: number;
}

interface ProductListPDFProps {
  products?: ProductRow[];
  driver: string;
  vehiclePlate?: string;
  tripId?: number | null;
  tripDate?: string | null;
  tripCreatedAt?: string | null;
  totalWeight?: number | string | null;
  noteCount?: number | null;
  danfes?: IDanfe[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    fontSize: 9,
    color: '#111827',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleBlock: {
    width: '70%',
    paddingRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    color: '#4b5563',
    marginBottom: 4,
  },
  topRightMeta: {
    width: '30%',
    alignItems: 'flex-end',
  },
  topRightText: {
    fontSize: 8,
    color: '#374151',
    marginBottom: 2,
  },
  inlineInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  inlineInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#111827',
    paddingVertical: 2,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 2,
    minHeight: 14,
  },
  colCode: {
    width: '8%',
    paddingRight: 4,
  },
  colDescription: {
    width: '74%',
    paddingRight: 6,
  },
  colQty: {
    width: '16%',
    textAlign: 'right',
  },
  muted: {
    color: '#6b7280',
  },
  deliveryBlock: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 7,
    marginBottom: 8,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deliveryTitle: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  deliveryMeta: {
    fontSize: 8,
    color: '#4b5563',
  },
  invoiceListBlock: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  invoiceListText: {
    fontSize: 8,
    color: '#374151',
    lineHeight: 1.4,
  },
});

const resolveEmissionDate = (tripCreatedAt?: string | null, tripDate?: string | null) => {
  const source = String(tripCreatedAt || tripDate || '').trim();
  if (!source) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return formatDateBR(source);

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const formatDecimal = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return parsed.toFixed(2);
};

const normalizeProductRows = (products: ProductRow[] = []) => {
  return products.map((product) => ({
    code: String(product.Product?.code || product.code || '').trim() || '-',
    description: String(product.Product?.description || product.description || '').trim() || 'Produto sem descricao',
    type: String(product.type || product.Product?.type || '').trim().toUpperCase(),
    quantity: Number(product.quantity || 0),
  }));
};

const formatQuantityWithUnit = (value: number | string | null | undefined, unit?: string | null) => {
  const formattedValue = formatDecimal(value);
  const normalizedUnit = String(unit || '').trim().toUpperCase();
  return normalizedUnit ? `${formattedValue} ${normalizedUnit}` : formattedValue;
};

const renderOperationalHeader = ({
  driver,
  vehiclePlate,
  totalWeight,
  noteCount,
  tripDate,
  tripCreatedAt,
  tripId,
}: ProductListPDFProps) => (
  <>
    <View style={styles.topBar}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Romaneio de Produtos</Text>
        <Text style={styles.subtitle}>Lista compacta para conferencia e consulta operacional da rota.</Text>
      </View>

      <View style={styles.topRightMeta}>
        <Text style={styles.topRightText}>{`Data: ${resolveEmissionDate(tripCreatedAt, tripDate)}`}</Text>
        <Text style={styles.topRightText}>{`Rota: ${tripId ? `#${tripId}` : '-'}`}</Text>
      </View>
    </View>

    <View style={styles.inlineInfoRow}>
      <Text style={styles.inlineInfoText}>{`Motorista: ${driver || '-'}`}</Text>
      <Text style={styles.inlineInfoText}>{`Placa: ${vehiclePlate || '-'}`}</Text>
      <Text style={styles.inlineInfoText}>{`Peso: ${formatDecimal(totalWeight)}`}</Text>
      <Text style={styles.inlineInfoText}>{`Notas: ${noteCount ?? '-'}`}</Text>
    </View>
  </>
);

const renderProductsTable = (products: ProductRow[] = []) => {
  const rows = normalizeProductRows(products);

  return (
    <>
      <Text style={styles.sectionTitle}>Produtos carregados</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.colCode}>Cod.</Text>
        <Text style={styles.colDescription}>Descricao</Text>
        <Text style={styles.colQty}>Qtd.</Text>
      </View>

      {rows.map((product, index) => (
        <View key={`${product.code}-${index}`} style={styles.row}>
          <Text style={styles.colCode}>{product.code}</Text>
          <Text style={styles.colDescription}>{product.description}</Text>
          <Text style={styles.colQty}>{formatQuantityWithUnit(product.quantity, product.type)}</Text>
        </View>
      ))}
    </>
  );
};

const renderInvoiceList = (danfes: IDanfe[] = []) => {
  if (!danfes.length) return null;

  const invoiceNumbers = danfes
    .map((danfe) => String(danfe.invoice_number || '').trim())
    .filter(Boolean);

  if (!invoiceNumbers.length) return null;

  return (
    <View style={styles.invoiceListBlock}>
      <Text style={styles.sectionTitle}>NFs da rota</Text>
      <Text style={styles.invoiceListText}>{invoiceNumbers.join(', ')}</Text>
    </View>
  );
};

const renderDeliveryList = (danfes: IDanfe[] = []) => (
  <>
    <Text style={styles.sectionTitle}>Lista de entregas</Text>
    {danfes.map((danfe, index) => (
      <View key={`${danfe.invoice_number}-${index}`} style={styles.deliveryBlock}>
        <View style={styles.deliveryHeader}>
          <Text style={styles.deliveryTitle}>{`Entrega ${index + 1} | NF ${danfe.invoice_number}`}</Text>
          <Text style={styles.deliveryMeta}>{formatDateBR(danfe.invoice_date)}</Text>
        </View>
        <Text>{danfe.Customer?.name_or_legal_entity || '-'}</Text>
        <Text style={styles.muted}>{danfe.Customer?.city || 'Cidade nao informada'}</Text>
        <View style={[styles.tableHeader, { marginTop: 5 }]}>
          <Text style={styles.colCode}>Cod.</Text>
          <Text style={styles.colDescription}>Descricao</Text>
          <Text style={styles.colQty}>Qtd.</Text>
        </View>
        {(danfe.DanfeProducts || []).map((product, productIndex) => (
          <View key={`${danfe.invoice_number}-${product.Product?.code || productIndex}`} style={styles.row}>
            <Text style={styles.colCode}>{product.Product?.code || '-'}</Text>
            <Text style={styles.colDescription}>{product.Product?.description || 'Produto sem descricao'}</Text>
            <Text style={styles.colQty}>{formatQuantityWithUnit(product.quantity, product.type || product.Product?.type)}</Text>
          </View>
        ))}
      </View>
    ))}
  </>
);

const renderPageContent = ({ products, danfes }: ProductListPDFProps) => {
  if (products && products.length > 0) {
    return (
      <>
        {renderProductsTable(products)}
        {renderInvoiceList(danfes)}
      </>
    );
  }

  if (danfes && danfes.length > 0) {
    return renderDeliveryList(danfes);
  }

  return null;
};

const ProductListPDF: React.FC<ProductListPDFProps> = (props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {renderOperationalHeader(props)}
      {renderPageContent(props)}
    </Page>
  </Document>
);

export default ProductListPDF;
