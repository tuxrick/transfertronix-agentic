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
import {useI18n} from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseRequests'>;

const STATUS_COLORS: Record<PurchaseRequestStatus, string> = {
  pending: '#f59e0b',
  quoted: '#3b82f6',
  awaiting_approval: '#a855f7',
  completed: '#22c55e',
  failed: '#ef4444',
  expired: '#64748b',
  cancelled: '#64748b',
};

const CANCELLABLE: PurchaseRequestStatus[] = ['pending', 'quoted'];

type Tab = 'open' | 'completed' | 'all';

const TABS: Tab[] = ['open', 'completed', 'all'];

const TAB_FILTERS: Record<Tab, (r: PurchaseRequest) => boolean> = {
  open: r => ['pending', 'quoted', 'awaiting_approval'].includes(r.status),
  completed: r => r.status === 'completed',
  all: () => true,
};

function formatDate(value: string | undefined, locale: string) {
  if (!value) return '';
  return new Date(value).toLocaleString(locale, {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
}

export default function PurchaseRequestsScreen({navigation}: Props) {
  const {t, locale} = useI18n();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('open');
  const visible = requests.filter(TAB_FILTERS[tab]);
  const totalSpent = requests
    .filter(TAB_FILTERS.completed)
    .reduce((sum, r) => sum + Number(r.final_amount ?? r.quoted_amount ?? 0), 0);

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
    Alert.alert(t('requests.cancelTitle'), t('requests.cancelConfirm', {item: request.item_description}), [
      {text: t('requests.no'), style: 'cancel'},
      {
        text: t('requests.yesCancel'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelPurchaseRequest(request.id);
            await loadRequests();
          } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
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
      Alert.alert(t('common.error'), error.message);
    }
  };

  const renderRequest = ({item}: {item: PurchaseRequest}) => {
    const status = {label: t(`requests.status.${item.status}`), color: STATUS_COLORS[item.status]};
    const amount = item.final_amount ?? item.quoted_amount ?? item.max_amount;

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestHeaderLeft}>
            <Text style={styles.requestAmount}>
              {amount ? `${Number(amount).toFixed(2)} ${item.currency}` : t('requests.notQuoted')}
            </Text>
            <Text style={styles.requestContact}>👤 {item.contact_name || t('requests.forMe')}</Text>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: status.color}]}>
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.requestDescription}>{item.item_description}</Text>

        {item.product_snapshot?.name && (
          <View style={styles.requestDetails}>
            <Text style={styles.requestDetailLabel}>{t('requests.product')}</Text>
            <Text style={styles.requestDetailValue}>
              {item.product_snapshot.name} · {item.product_snapshot.merchant}
            </Text>
          </View>
        )}
        {item.order_id && (
          <View style={styles.requestDetails}>
            <Text style={styles.requestDetailLabel}>{t('requests.order')}</Text>
            <Text style={styles.requestDetailValue}>
              {item.order_id}
              {item.product_snapshot?.demo ? t('requests.simulated') : ''}
            </Text>
          </View>
        )}
        <View style={styles.requestDetails}>
          <Text style={styles.requestDetailLabel}>{item.status === 'completed' ? t('requests.purchasedAt') : t('requests.requestedAt')}</Text>
          <Text style={styles.requestDetailValue}>{formatDate(item.completed_at || item.created_at, locale)}</Text>
        </View>
        {item.max_amount && item.status !== 'completed' && (
          <View style={styles.requestDetails}>
            <Text style={styles.requestDetailLabel}>{t('requests.cap')}</Text>
            <Text style={styles.requestDetailValue}>
              {Number(item.max_amount).toFixed(2)} {item.currency}
            </Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          {CANCELLABLE.includes(item.status) && (
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => handleCancel(item)}>
              <Text style={styles.actionButtonText}>{t('requests.cancel')}</Text>
            </TouchableOpacity>
          )}
          {item.status === 'awaiting_approval' && (
            <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={() => handleSync(item)}>
              <Text style={styles.actionButtonText}>{t('requests.refresh')}</Text>
            </TouchableOpacity>
          )}
          {CANCELLABLE.includes(item.status) && (
            <TouchableOpacity style={[styles.actionButton, styles.payButton]} onPress={() => navigation.navigate('Chat')}>
              <Text style={styles.actionButtonText}>{t('requests.handleInChat')}</Text>
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
        <Text style={styles.headerTitle}>{t('requests.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {TABS.map(key => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {t(`requests.tabs.${key}`)} ({requests.filter(TAB_FILTERS[key]).length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'completed' && totalSpent > 0 && (
        <Text style={styles.totalSpent}>{t('requests.totalSpent', {amount: totalSpent.toFixed(2)})}</Text>
      )}

      <FlatList
        data={visible}
        renderItem={renderRequest}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>{tab === 'completed' ? t('requests.emptyPurchases') : t('requests.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('requests.emptyBody')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  totalSpent: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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

