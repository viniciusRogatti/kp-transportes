import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { ITrip } from '../types/types';

interface TripsPDFProps {
  trips: ITrip[];
  freightValues: { [key: number]: number };
  tollValue: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
  },
  section: {
    marginBottom: 10,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '33%',
    borderStyle: 'solid',
    borderWidth: 1,
    backgroundColor: '#f0f0f0',
  },
  tableCol: {
    width: '33%',
    borderStyle: 'solid',
    borderWidth: 1,
  },
  tableCellHeader: {
    margin: 5,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableCell: {
    margin: 5,
    fontSize: 10,
  },
});

const TripsPDF: React.FC<TripsPDFProps> = ({ trips, freightValues, tollValue }) => (
  <Document>
    <Page style={styles.page}>
      <View style={styles.section}>
        <Text>Trip Report</Text>
      </View>
      <View style={styles.section}>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>Date</Text>
            </View>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>Cities</Text>
            </View>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>Freight Value</Text>
            </View>
          </View>
          {trips.map(trip => (
            <View style={styles.tableRow} key={trip.id}>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{trip.date}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{trip.TripNotes.map(note => note.city).join(', ')}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{freightValues[trip.id] || '0'}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Text>Total Toll Value: {tollValue}</Text>
      </View>
    </Page>
  </Document>
);

export default TripsPDF;
