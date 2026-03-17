import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nivo Mobile</Text>
      <Text style={styles.subtitle}>Sistema POS para Zapaterias</Text>

      <View style={styles.menu}>
        <Link href="/scanner" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>📷</Text>
            <Text style={styles.menuLabel}>Escanear Inventario</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/pos" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>🛒</Text>
            <Text style={styles.menuLabel}>Caja Movil</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/sync" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>🔄</Text>
            <Text style={styles.menuLabel}>Sincronizacion</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 48 },
  menu: { width: '100%', gap: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 20, gap: 16 },
  menuIcon: { fontSize: 28 },
  menuLabel: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
});
