import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { IDanfe } from '../types/types';
import { formatDateBR } from '../utils/dateDisplay';
import { RetainedReminder } from '../utils/retainedReminders';
import { ProntoBoxRow, SalmonSeparationRow } from '../utils/tripProductManifest';

interface ProductRow {
  company_name?: string;
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
  retainedReminders?: RetainedReminder[];
  salmonSeparations?: SalmonSeparationRow[];
  prontoBoxes?: ProntoBoxRow[];
}

const CONTINUATION_HEADER_HEIGHT = 104;
const FOOTER_HEIGHT = 18;
const styles = StyleSheet.create({
  page: {
    paddingTop: 18 + CONTINUATION_HEADER_HEIGHT,
    paddingBottom: 18 + FOOTER_HEIGHT,
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
  fixedHeader: {
    position: 'absolute',
    top: 18,
    left: 22,
    right: 22,
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
  attentionCard: {
    borderWidth: 1.2,
    borderColor: '#92400e',
    backgroundColor: '#fef3c7',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  attentionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#7c2d12',
    marginBottom: 4,
  },
  attentionItem: {
    marginBottom: 4,
  },
  attentionItemTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 1,
  },
  attentionItemText: {
    fontSize: 8,
    color: '#111827',
    lineHeight: 1.35,
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
  colCustomer: {
    width: '38%',
    paddingRight: 6,
  },
  colSalmonProduct: {
    width: '46%',
    paddingRight: 6,
  },
  colInvoice: {
    width: '70%',
    paddingRight: 6,
  },
  colBoxes: {
    width: '28%',
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
  separatorRow: {
    marginTop: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  separatorLabel: {
    fontSize: 8,
    marginRight: 6,
    textTransform: 'uppercase',
  },
  separatorLine: {
    flexGrow: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 10,
  },
  footer: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 3,
  },
  footerText: {
    fontSize: 8,
    color: '#000000',
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

const formatBoxQuantity = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'NAO INFORMADO';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(parsed);
};

const normalizeProductRows = (products: ProductRow[] = []) => {
  return products.map((product) => ({
    company_name: String(product.company_name || '').trim(),
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

const formatCustomerDocument = (value: string) => {
  const originalValue = String(value || '').trim();
  const digits = originalValue.replace(/\D/g, '');

  if (digits.length === 14) {
    return `CNPJ: ${digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`;
  }
  if (digits.length === 11) {
    return `CPF: ${digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`;
  }

  return originalValue ? `Documento: ${originalValue}` : '';
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

const renderHeaderSummary = ({
  driver,
  vehiclePlate,
  totalWeight,
  noteCount,
  tripDate,
  tripCreatedAt,
  tripId,
}: ProductListPDFProps) => (
  <View>
    <View style={styles.topBar}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Romaneio de Produtos</Text>
        <Text style={styles.subtitle}>Lista para separacao previa e conferencia dos volumes da rota.</Text>
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
  </View>
);

const renderFirstPageExtras = ({
  danfes,
  retainedReminders,
  products,
  salmonSeparations,
  prontoBoxes,
}: ProductListPDFProps) => {
  const tripCities = resolveTripCities(danfes);
  const hasProducts = Boolean(products?.length || salmonSeparations?.length || prontoBoxes?.length);

  return (
    <View style={styles.headerCard}>
      {hasProducts ? (
        <View style={styles.separatorRow}>
          <Text style={styles.separatorLabel}>Separado por</Text>
          <View style={styles.separatorLine} />
        </View>
      ) : null}
      {tripCities.length ? (
        <View style={styles.citiesRow}>
          <Text style={styles.inlineInfoCitiesText}>{`Cidades: ${tripCities.join(', ')}`}</Text>
        </View>
      ) : null}
      {retainedReminders?.length ? (
        <View style={styles.attentionCard}>
          <Text style={styles.attentionTitle}>ATENCAO: recolher canhotos retidos nesta rota</Text>
          {retainedReminders.map((reminder) => (
            <View
              key={`${reminder.matchType}-${reminder.retainedInvoiceNumber}`}
              style={styles.attentionItem}
            >
              <Text style={styles.attentionItemTitle}>
                {`NF ${reminder.retainedInvoiceNumber} | ${reminder.retainedCustomerName}`}
              </Text>
              {reminder.matchType === 'customer' ? (
                <Text style={styles.attentionItemText}>
                  {`Voce tem entrega no cliente ${reminder.retainedCustomerName}. Lembre-se de recolher o canhoto retido da NF ${reminder.retainedInvoiceNumber} ao atender a(s) NF(s) ${reminder.routeInvoiceNumbers.join(', ')}.`}
                </Text>
              ) : (
                <>
                  <Text style={styles.attentionItemText}>
                    {`Nao ha entrega deste cliente na rota atual. Aproveite a passagem por ${reminder.city || 'esta cidade'} para recolher o canhoto retido do cliente ${reminder.retainedCustomerName}.`}
                  </Text>
                  <Text style={styles.attentionItemText}>
                    {`Endereco: ${reminder.addressLine || 'Endereco nao localizado.'}`}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const renderFixedHeader = ({
  driver,
  vehiclePlate,
  totalWeight,
  noteCount,
  tripDate,
  tripCreatedAt,
  tripId,
}: ProductListPDFProps) => (
  <View style={[styles.headerCard, styles.fixedHeader]} fixed>
    {renderHeaderSummary({ driver, vehiclePlate, totalWeight, noteCount, tripDate, tripCreatedAt, tripId })}
  </View>
);

const renderFooter = () => (
  <View style={styles.footer} fixed>
    <Text
      style={styles.footerText}
      render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
    />
  </View>
);

const renderProductsTable = (products: ProductRow[] = []) => {
  const rowsByCompany = normalizeProductRows(products).reduce<Map<string, ProductRow[]>>((groups, product) => {
    const companyName = String(product.company_name || 'Empresa nao identificada').trim();
    groups.set(companyName, [...(groups.get(companyName) || []), product]);
    return groups;
  }, new Map());

  return (
    <>
      {Array.from(rowsByCompany.entries()).map(([companyName, companyRows]) => (
        <View key={companyName} style={{ marginBottom: 10 }}>
          <Text style={styles.sectionTitle}>{`Produtos carregados - ${companyName}`}</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colCode}>Cod.</Text>
            <Text style={styles.colDescription}>Descricao</Text>
            <Text style={styles.colQty}>Qtd.</Text>
          </View>
          {companyRows.map((product, index) => (
            <View key={`${product.code}-${index}`} style={styles.row}>
              <Text style={styles.colCode}>{product.code}</Text>
              <Text style={styles.colDescription}>{product.description}</Text>
              <Text style={styles.colQty}>{formatQuantityWithUnit(product.quantity, product.type)}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
};

const renderSalmonSeparations = (rows: SalmonSeparationRow[] = []) => {
  if (!rows.length) return null;
  const rowsByCompany = rows.reduce<Map<string, SalmonSeparationRow[]>>((groups, row) => {
    const companyName = String(row.companyName || 'Empresa nao identificada').trim();
    groups.set(companyName, [...(groups.get(companyName) || []), row]);
    return groups;
  }, new Map());

  return (
    <>
      {Array.from(rowsByCompany.entries()).map(([companyName, companyRows]) => (
        <View key={companyName} style={{ marginBottom: 10 }}>
          <Text style={styles.sectionTitle}>{`Separacao de salmao por cliente - ${companyName}`}</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colCustomer}>Cliente / CNPJ ou CPF</Text>
            <Text style={styles.colSalmonProduct}>Produto</Text>
            <Text style={styles.colQty}>Qtd.</Text>
          </View>
          {companyRows.map((row) => (
            <View key={`${row.companyId}-${row.customerDocument}-${row.code}-${row.type}`} style={styles.row}>
              <Text style={styles.colCustomer}>{`${row.customerName}${row.customerDocument ? `\n${formatCustomerDocument(row.customerDocument)}` : ''}`}</Text>
              <Text style={styles.colSalmonProduct}>{row.description}</Text>
              <Text style={styles.colQty}>{formatQuantityWithUnit(row.quantity, row.type)}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
};

const renderProntoBoxes = (rows: ProntoBoxRow[] = []) => {
  if (!rows.length) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>Separacao de caixas por NF - PRONTO</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.colInvoice}>Nota fiscal</Text>
        <Text style={styles.colBoxes}>Caixas</Text>
      </View>
      {rows.map((row) => (
        <View key={row.invoiceNumber} style={styles.row}>
          <Text style={styles.colInvoice}>{`NF ${row.invoiceNumber}`}</Text>
          <Text style={styles.colBoxes}>{formatBoxQuantity(row.boxQuantity)}</Text>
        </View>
      ))}
    </View>
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

const renderPageContent = ({ products, danfes, salmonSeparations, prontoBoxes }: ProductListPDFProps) => {
  if (prontoBoxes && prontoBoxes.length > 0 && !products?.length && !salmonSeparations?.length) {
    return renderProntoBoxes(prontoBoxes);
  }

  if (products && products.length > 0) {
    return (
      <>
        {renderInvoiceList(danfes)}
        {renderProntoBoxes(prontoBoxes)}
        {renderSalmonSeparations(salmonSeparations)}
        {renderProductsTable(products)}
      </>
    );
  }

  if (salmonSeparations && salmonSeparations.length > 0) {
    return (
      <>
        {renderInvoiceList(danfes)}
        {renderProntoBoxes(prontoBoxes)}
        {renderSalmonSeparations(salmonSeparations)}
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
      {renderFixedHeader(props)}
      {renderFirstPageExtras(props)}
      {renderFooter()}
      {renderPageContent(props)}
    </Page>
  </Document>
);

export default ProductListPDF;
