import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
    marginBottom: 10,
  },
});

const ProductListPDF: React.FC<ProductListPDFProps> = ({ products, driver }) => (
  <Document>
    <Page size="A4" style={styles.page}>
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
