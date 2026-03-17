import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function SyncScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.statusIcon}>✅</Text>
        <Text style={styles.statusTitle}>Conectado</Text>
        <Text style={styles.statusDescription}>Todas las ventas estan sincronizadas.</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Ventas pendientes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Ventas sincronizadas</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.syncButton}>
        <Text style={styles.syncButtonText}>🔄 Sincronizar ahora</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  statusCard: { alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 12, padding: 24, marginBottom: 24 },
  statusIcon: { fontSize: 48, marginBottom: 8 },
  statusTitle: { fontSize: 20, fontWeight: 'bold', color: '#16a34a', marginBottom: 4 },
  statusDescription: { fontSize: 14, color: '#6b7280' },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statItem: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  syncButton: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16, alignItems: 'center' },
  syncButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
