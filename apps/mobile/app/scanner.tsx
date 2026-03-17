import { View, Text, StyleSheet } from 'react-native';

export default function ScannerScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.placeholderText}>📷</Text>
        <Text style={styles.title}>Escaneo de Inventario</Text>
        <Text style={styles.description}>
          Apunta la camara al codigo de barras del producto para verificar o ajustar el inventario.
        </Text>
        <Text style={styles.note}>
          Requiere permiso de camara (expo-camera).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f2937', padding: 24 },
  placeholderText: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  description: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 16, maxWidth: 280 },
  note: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },
});
