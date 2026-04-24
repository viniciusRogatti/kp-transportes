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
    color: '#000000',
  },
  headerCard: {
    borderWidth: 1,
    borderColor: '#000000',
    paddingTop: 8,
    paddingBottom: 7,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
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
    color: '#000000',
    marginBottom: 0,
  },
  topRightMeta: {
    width: '30%',
    alignItems: 'flex-end',
  },
  topRightText: {
    fontSize: 8,
    color: '#000000',
    marginBottom: 2,
  },
  inlineInfoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 4,
  },
  infoCell: {
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginRight: 4,
  },
  driverInfoCell: {
    flexGrow: 2.8,
    flexShrink: 1,
    flexBasis: 0,
  },
  plateInfoCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  weightInfoCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  notesInfoCell: {
    flexGrow: 0.7,
    flexShrink: 1,
    flexBasis: 0,
  },
  lastInfoCell: {
    marginRight: 0,
  },
  infoLabel: {
    fontSize: 7,
    color: '#000000',
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  inlineInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  citiesRow: {
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  inlineInfoCitiesText: {
    fontSize: 9,
    color: '#000000',
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
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
    color: '#000000',
  },
  deliveryBlock: {
    borderWidth: 1,
    borderColor: '#000000',
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
    color: '#000000',
  },
  invoiceListBlock: {
    marginTop: 2,
    marginBottom: 2,
  },
  invoiceListText: {
    fontSize: 12,
    color: '#000000',
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

const resolveTripCities = (danfes: IDanfe[] = []) => {
  const uniqueCities = new Map<string, string>();

  danfes.forEach((danfe) => {
    const city = String(danfe.Customer?.city || '').trim();
    if (!city) return;

    const normalizedKey = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!uniqueCities.has(normalizedKey)) uniqueCities.set(normalizedKey, city);
  });

  return Array.from(uniqueCities.values());
};

const renderOperationalHeader = ({
  driver,
  vehiclePlate,
  totalWeight,
  noteCount,
  tripDate,
  tripCreatedAt,
  tripId,
  danfes,
}: ProductListPDFProps) => {
  const tripCities = resolveTripCities(danfes);

  return (
    <View style={styles.headerCard}>
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
        <View style={[styles.infoCell, styles.driverInfoCell]}>
          <Text style={styles.infoLabel}>Motorista</Text>
          <Text style={styles.inlineInfoText}>{driver || '-'}</Text>
        </View>
        <View style={[styles.infoCell, styles.plateInfoCell]}>
          <Text style={styles.infoLabel}>Placa</Text>
          <Text style={styles.inlineInfoText}>{vehiclePlate || '-'}</Text>
        </View>
        <View style={[styles.infoCell, styles.weightInfoCell]}>
          <Text style={styles.infoLabel}>Peso</Text>
          <Text style={styles.inlineInfoText}>{formatDecimal(totalWeight)}</Text>
        </View>
        <View style={[styles.infoCell, styles.notesInfoCell, styles.lastInfoCell]}>
          <Text style={styles.infoLabel}>Notas</Text>
          <Text style={styles.inlineInfoText}>{noteCount ?? '-'}</Text>
        </View>
      </View>
      {tripCities.length ? (
        <View style={styles.citiesRow}>
          <Text style={styles.inlineInfoCitiesText}>{`Cidades: ${tripCities.join(', ')}`}</Text>
        </View>
      ) : null}
    </View>
  );
};

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
        {renderInvoiceList(danfes)}
        {renderProductsTable(products)}
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
