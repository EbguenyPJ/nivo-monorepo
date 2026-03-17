import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

export default function MobilePosScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Caja Movil</Text>
        <Text style={styles.headerSubtitle}>0 productos en el carrito</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.emptyText}>Escanea un producto o buscalo para comenzar la venta.</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>$0.00</Text>
        </View>
        <TouchableOpacity style={[styles.payButton, { opacity: 0.5 }]} disabled>
          <Text style={styles.payButtonText}>Cobrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, color: '#6b7280' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#9ca3af', textAlign: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 18, fontWeight: '600' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#3b82f6' },
  payButton: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16, alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
