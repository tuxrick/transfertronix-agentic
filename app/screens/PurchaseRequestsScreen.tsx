import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import type {PurchaseRequest, PurchaseRequestStatus} from '../types/purchaseRequest';
import {cancelPurchaseRequest, getPurchaseRequests, syncCheckout} from '../lib/purchaseRequests';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseRequests'>;

const STATUS_STYLES: Record<PurchaseRequestStatus, {label: string; color: string}> = {
  pending: {label: 'Pendiente', color: '#f59e0b'},
  quoted: {label: 'Cotizada', color: '#3b82f6'},
  awaiting_approval: {label: 'Por aprobar', color: '#a855f7'},
  completed: {label: 'Comprada', color: '#22c55e'},
  failed: {label: 'Falló', color: '#ef4444'},
  expired: {label: 'Expiró', color: '#64748b'},
  cancelled: {label: 'Cancelada', color: '#64748b'},
};

const CANCELLABLE: PurchaseRequestStatus[] = ['pending', 'quoted'];

export default function PurchaseRequestsScreen({navigation}: Props) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await getPurchaseRequests());
    } catch (error) {
      console.error('Error loading purchase requests:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleCancel = (request: PurchaseRequest) => {
    Alert.alert('Cancelar solicitud', `¿Cancelar "${request.item_description}"?`, [
      {text: 'No', style: 'cancel'},
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelPurchaseRequest(request.id);
            await loadRequests();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleSync = async (request: PurchaseRequest) => {
    try {
      await syncCheckout(request);
      await loadRequests();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderRequest = ({item}: {item: PurchaseRequest}) => {
    const status = STATUS_STYLES[item.status];
    const amount = item.final_amount ?? item.quoted_amount ?? item.max_amount;

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestHeaderLeft}>
            <Text style={styles.requestAmount}>
              {amount ? `${Number(amount).toFixed(2)} ${item.currency}` : 'Sin cotizar'}
            </Text>
            <Text style={styles.requestContact}>👤 {item.contact_name || 'Para mí'}</Text>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: status.color}]}>
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.requestDescription}>{item.item_description}</Text>

        {item.product_snapshot?.name && (
          <View style={styles.requestDetails}>
            <Text style={styles.requestDetailLabel}>Producto</Text>
            <Text style={styles.requestDetailValue}>
              {item.product_snapshot.name} · {item.product_snapshot.merchant}
            </Text>
          </View>
        )}
        {item.order_id && (
          <View style={styles.requestDetails}>
            <Text style={styles.requestDetailLabel}>Orden</Text>
            <Text style={styles.requestDetailValue}>{item.order_id}</Text>
          </View>
        )}
        {item.max_amount && item.status !== 'completed' && (
          <View style={styles.requestDetails}>
            <Text style={styles.requestDetailLabel}>Tope</Text>
            <Text style={styles.requestDetailValue}>
              {Number(item.max_amount).toFixed(2)} {item.currency}
            </Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          {CANCELLABLE.includes(item.status) && (
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => handleCancel(item)}>
              <Text style={styles.actionButtonText}>Cancelar</Text>
            </TouchableOpacity>
          )}
          {item.status === 'awaiting_approval' && (
            <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={() => handleSync(item)}>
              <Text style={styles.actionButtonText}>Actualizar estado</Text>
            </TouchableOpacity>
          )}
          {CANCELLABLE.includes(item.status) && (
            <TouchableOpacity style={[styles.actionButton, styles.payButton]} onPress={() => navigation.navigate('Chat')}>
              <Text style={styles.actionButtonText}>Atender en el chat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitudes de compra</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>Sin solicitudes</Text>
            <Text style={styles.emptySubtitle}>
              Pídele algo al agente en el chat, por ejemplo: "Mándale pañales a mamá"
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  backButton: {
    fontSize: 28,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSpacer: {
    width: 28,
  },
  listContainer: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  directionBadge: {
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  directionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestHeaderLeft: {
    flex: 1,
  },
  requestAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  requestContact: {
    fontSize: 16,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  requestDescription: {
    fontSize: 14,
    color: '#AEAEB2',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  requestDetails: {
    marginTop: 8,
  },
  requestDetailLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  requestDetailValue: {
    fontSize: 14,
    color: '#FFF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  shareButton: {
    backgroundColor: '#007AFF',
  },
  payButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
});

