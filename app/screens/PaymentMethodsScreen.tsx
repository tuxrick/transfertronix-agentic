import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import type {PaymentMethod, PaymentSetup, VaultInfo} from '../types/commerce';
import {getPaymentSetup, startPaymentSetup} from '../lib/commerceApi';
import {useI18n} from '../lib/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentMethods'>;

const CARD_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  REQUIRES_ACTION: '#f59e0b',
  REVOKED: '#64748b',
  FAILED: '#ef4444',
  EXPIRED: '#64748b',
};

/**
 * Reap: tarjetas guardadas (enrollments); se capturan en la página de Reap.
 * Kwal: bóveda USDC en Ink Sepolia que respalda la tarjeta del agente.
 */
export default function PaymentMethodsScreen({navigation}: Props) {
  const {t} = useI18n();
  const [setup, setSetup] = useState<PaymentSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setSetup(await getPaymentSetup());
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleAddCard = async () => {
    setCreating(true);
    try {
      const {actionUrl} = await startPaymentSetup();
      if (actionUrl) await Linking.openURL(actionUrl);
      await load();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setCreating(false);
    }
  };

  const renderCard = (method: PaymentMethod) => {
    const status = {
      label: t(`payments.status.${method.status}`),
      color: CARD_STATUS_COLORS[method.status] || '#64748b',
    };
    return (
      <View key={method.id} style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{method.label || t('payments.cardInProgress')}</Text>
          <View style={[styles.badge, {backgroundColor: status.color}]}>
            <Text style={styles.badgeText}>{status.label}</Text>
          </View>
        </View>
        {method.actionUrl && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(method.actionUrl!)}>
            <Text style={styles.buttonText}>{t('payments.completeSetup')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderVault = (vault: VaultInfo) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('payments.vault')} · {vault.chain || 'Ink Sepolia'}</Text>
      <Text style={styles.cardSubtitle}>{t(`payments.vaultStatus.${vault.state}`)}</Text>
      {vault.available && (
        <Text style={styles.balance}>
          {vault.available.amount.toFixed(2)} {vault.available.currency}
        </Text>
      )}
      {vault.address && (
        <Text style={styles.mono} numberOfLines={1} ellipsizeMode="middle">
          {vault.address}
        </Text>
      )}
      <View style={styles.linksRow}>
        {vault.explorerUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(vault.explorerUrl!)}>
            <Text style={styles.link}>{t('payments.explorer')}</Text>
          </TouchableOpacity>
        )}
        {vault.usdcFaucetUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(vault.usdcFaucetUrl!)}>
            <Text style={styles.link}>{t('payments.usdcFaucet')}</Text>
          </TouchableOpacity>
        )}
        {vault.gasFaucetUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(vault.gasFaucetUrl!)}>
            <Text style={styles.link}>{t('payments.ethFaucet')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const isReap = setup?.provider === 'reap';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerTitle}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payments.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#3b82f6" />}>
          <Text style={styles.info}>
            {isReap ? t('payments.reapInfo') : t('payments.kwalInfo')}
          </Text>
          {isReap && setup?.methods.length === 0 && (
            <Text style={styles.empty}>{t('payments.empty')}</Text>
          )}
          {isReap && setup?.methods.map(renderCard)}
          {!isReap && setup?.vault && renderVault(setup.vault)}
        </ScrollView>
      )}

      {isReap && (
        <TouchableOpacity
          style={[styles.primaryButton, creating && styles.buttonDisabled]}
          onPress={handleAddCard}
          disabled={creating}>
          {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>{t('payments.addCard')}</Text>}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f172a'},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {fontSize: 18, fontWeight: 'bold', color: '#ffffff'},
  headerSpacer: {width: 24},
  loader: {marginTop: 40},
  list: {padding: 16, gap: 12},
  info: {color: '#94a3b8', fontSize: 13, marginBottom: 8, lineHeight: 18},
  empty: {color: '#64748b', textAlign: 'center', marginTop: 32},
  card: {backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155'},
  cardRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  cardTitle: {color: '#ffffff', fontSize: 16, fontWeight: '600'},
  cardSubtitle: {color: '#94a3b8', fontSize: 13, marginTop: 4},
  balance: {color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginTop: 12},
  mono: {color: '#94a3b8', fontSize: 12, fontFamily: 'Courier', marginTop: 8},
  linksRow: {flexDirection: 'row', gap: 16, marginTop: 12},
  link: {color: '#3b82f6', fontSize: 13, fontWeight: '600'},
  badge: {borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4},
  badgeText: {color: '#ffffff', fontSize: 12, fontWeight: '600'},
  primaryButton: {
    backgroundColor: '#3b82f6',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f59e0b',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {opacity: 0.5},
  buttonText: {color: '#ffffff', fontSize: 15, fontWeight: '600'},
});
