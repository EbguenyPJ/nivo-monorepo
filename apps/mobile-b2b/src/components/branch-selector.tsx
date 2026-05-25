import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryClient } from '../api/query-client';
import { useAuthStore } from '../stores/auth.store';

interface Branch {
  id: string;
  name: string;
}

export function BranchSelector() {
  const [open, setOpen] = useState(false);
  const employee = useAuthStore((s) => s.employee);
  const setBranchId = useAuthStore((s) => s.setBranchId);
  const isAdmin = employee?.role === 'admin' || employee?.role === 'manager' || employee?.is_owner;

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await api.get<Branch[]>('/branches');
      return data;
    },
    enabled: !!isAdmin,
  });

  const currentBranch = branches?.find((b) => b.id === employee?.branch_id);
  const branchName = currentBranch?.name ?? 'Sucursal';

  if (!isAdmin) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <Ionicons name="storefront-outline" size={11} color="#64748b" />
        <Text style={{ color: '#94a3b8', fontSize: 11, marginLeft: 3, fontWeight: '500' }} numberOfLines={1}>
          {branchName}
        </Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}
      >
        <Ionicons name="storefront-outline" size={11} color="#22d3ee" />
        <Text
          style={{ color: '#94a3b8', fontSize: 11, fontWeight: '500', marginLeft: 3, maxWidth: 160 }}
          numberOfLines={1}
        >
          {branchName}
        </Text>
        <Ionicons name="chevron-down" size={11} color="#64748b" style={{ marginLeft: 2 }} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 40 }}
        >
          <View
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              width: '100%',
              maxHeight: 320,
              overflow: 'hidden',
            }}
          >
            <Text style={{ color: '#e2e8f0', fontSize: 15, fontWeight: '700', padding: 16, paddingBottom: 8 }}>
              Cambiar sucursal
            </Text>
            <FlatList
              data={branches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isActive = item.id === employee?.branch_id;
                return (
                  <TouchableOpacity
                    onPress={async () => {
                      await setBranchId(item.id);
                      queryClient.invalidateQueries();
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      backgroundColor: isActive ? 'rgba(14,165,233,0.12)' : 'transparent',
                    }}
                  >
                    <Ionicons
                      name={isActive ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isActive ? '#22d3ee' : '#475569'}
                    />
                    <Text
                      style={{
                        color: isActive ? '#22d3ee' : '#cbd5e1',
                        fontSize: 14,
                        fontWeight: isActive ? '700' : '400',
                        marginLeft: 10,
                      }}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
