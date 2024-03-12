import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { IDanfe } from '../types/types';

interface Product {
  Product: {
    code: string;
    description: string;
    type: string;
  };
  quantity: number;
}

interface ProductListPDFProps {
  products: Product[];
  driver: String;
  danfes: IDanfe[] | [];
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 20,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -1,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 5,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  columnValue: {
    fontSize: 10,
    padding: 5,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
});

const ProductListPDF: React.FC<ProductListPDFProps> = ({ products, driver, danfes }) => (
<Document>
  <Page size="A4" style={styles.page}>
    {danfes.map((danfe, index) => (
        <View key={danfe.invoice_number}>
          <Text style={styles.title}>{`${driver} Entrega nmr: ${index}`}</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>NF: {danfe.invoice_number}</Text>
          <Text>{danfe.Customer.name_or_legal_entity}</Text>
          <Text>{danfe.Customer.city}</Text>
          <Text style={{ fontSize: 12 }}>{danfe.invoice_date}</Text>
          <Text style={{ textAlign: 'center' }}>Lista de produtos</Text>
          {danfe.DanfeProducts.map((product) => (
            <View key={product.Product.code} style={styles.listItem}>
              <Text style={styles.columnValue}>{product.Product.code}</Text>
              <Text style={styles.columnValue}>{product.Product.description}</Text>
              <Text style={styles.columnValue}>{product.quantity}</Text>
            </View>
          ))}
          <View style={{ marginBottom: 20 }} />
        </View>
    ))}
    <View>
        <Text style={styles.title}>{driver}</Text>
        <View style={styles.listItem}>
          <Text style={styles.columnHeader}>Código do Produto</Text>
          <Text style={styles.columnHeader}>Descrição do Produto</Text>
          <Text style={styles.columnHeader}>Quantidade</Text>
        </View>
        {products.map((product, index) => (
          <View key={index}>
            <View style={styles.listItem}>
              <Text style={styles.columnValue}>{product.Product.code}</Text>
              <Text style={styles.columnValue}>{product.Product.description}</Text>
              <Text style={styles.columnValue}>{product.quantity}</Text>
            </View>
            {index !== products.length - 1 && <View style={{ borderBottomWidth: 1, borderBottomColor: '#000000', marginBottom: 5 }} />}
          </View>
        ))}
      </View>
  </Page>
  </Document>
);

export default ProductListPDF;
