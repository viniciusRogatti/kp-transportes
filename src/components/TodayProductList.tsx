import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { IGroupedProduct } from "../types/types";

interface TodayProductListProps {
  products: IGroupedProduct[];
}

const styles = StyleSheet.create({
  page: { padding: 10 },
  section: { fontSize: 12 },
  header: { fontSize: 18, marginBottom: 20 },
  table: { display: "flex", flexDirection: "column", borderStyle: "solid", borderWidth: 1 },
  tableRow: { display: "flex", flexDirection: "row" },
  tableColCode: { width: '10%', borderStyle: "solid", borderWidth: 1 },
  tableColDescription: { width: '80%', borderStyle: "solid", borderWidth: 1, maxWidth: '80%' },
  tableColQuantity: { width: '10%', borderStyle: "solid", borderWidth: 1 },
  tableCell: { margin: "auto", marginTop: 5, fontSize: 10, padding: 5 }
});

const truncateText = (text: string, maxLength: number) => {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const TodayProductList: React.FC<TodayProductListProps> = ({ products }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.header}>Products Report</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={styles.tableColCode}><Text style={styles.tableCell}>Code</Text></View>
            <View style={styles.tableColDescription}><Text style={styles.tableCell}>Description</Text></View>
            <View style={styles.tableColQuantity}><Text style={styles.tableCell}>Quantity</Text></View>
          </View>
          {products.map((product, index) => (
            <View style={styles.tableRow} key={index}>
              <View style={styles.tableColCode}><Text style={styles.tableCell}>{product.Product.code}</Text></View>
              <View style={styles.tableColDescription}><Text style={styles.tableCell}>{truncateText(product.Product.description, 50)}</Text></View>
              <View style={styles.tableColQuantity}><Text style={styles.tableCell}>{product.quantity}</Text></View>
            </View>
          ))}
        </View>
      </View>
    </Page>
  </Document>
);

export default TodayProductList;
