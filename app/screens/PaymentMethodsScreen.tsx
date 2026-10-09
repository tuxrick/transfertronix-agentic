import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import type {Enrollment, EnrollmentStatus} from '../types/reap';
import {createEnrollment, listEnrollments} from '../lib/reapApi';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentMethods'>;

const STATUS_LABELS: Record<EnrollmentStatus, {label: string; color: string}> = {
  ACTIVE: {label: 'Activa', color: '#22c55e'},
  REQUIRES_ACTION: {label: 'Falta completar', color: '#f59e0b'},
  REVOKED: {label: 'Revocada', color: '#64748b'},
  FAILED: {label: 'Falló', color: '#ef4444'},
  EXPIRED: {label: 'Expiró', color: '#64748b'},
};

/**
 * Métodos de pago = enrollments de Reap. La tarjeta se captura en la página
 * hospedada de Reap; la app solo ve red y últimos 4 dígitos.
 */
export default function PaymentMethodsScreen({navigation}: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const {items} = await listEnrollments();
      setEnrollments(items);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openHostedStep = async (enrollment: Enrollment) => {
    if (enrollment.nextAction?.url) {
      await Linking.openURL(enrollment.nextAction.url);
    }
  };

  const handleAdd = async () => {
    setCreating(true);
    try {
      const enrollment = await createEnrollment();
      await openHostedStep(enrollment);
      await load();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({item}: {item: Enrollment}) => {
    const status = STATUS_LABELS[item.status];
    const card = item.paymentMethod;
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>
            {card ? `${card.network} •••• ${card.last4}` : 'Tarjeta en registro'}
          </Text>
          <View style={[styles.badge, {backgroundColor: status.color}]}>
            <Text style={styles.badgeText}>{status.label}</Text>
          </View>
        </View>
        {card && (
          <Text style={styles.cardSubtitle}>
            Vence {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
          </Text>
        )}
        {item.status === 'REQUIRES_ACTION' && item.nextAction?.url && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => openHostedStep(item)}>
            <Text style={styles.buttonText}>Completar registro</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerTitle}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Métodos de pago</Text>
        <View style={{width: 24}} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
      ) : (
        <FlatList
          data={enrollments}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#3b82f6" />}
          ListHeaderComponent={
            <Text style={styles.info}>
              🔐 Tu tarjeta se guarda en Reap. El agente nunca ve sus datos y tú apruebas cada cargo.
            </Text>
          }
          ListEmptyComponent={<Text style={styles.empty}>Aún no tienes métodos de pago.</Text>}
        />
      )}

      <TouchableOpacity
        style={[styles.primaryButton, creating && styles.buttonDisabled]}
        onPress={handleAdd}
        disabled={creating}>
        {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>➕ Agregar tarjeta</Text>}
      </TouchableOpacity>
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
  loader: {marginTop: 40},
  list: {padding: 16, gap: 12},
  info: {color: '#94a3b8', fontSize: 13, marginBottom: 8, lineHeight: 18},
  empty: {color: '#64748b', textAlign: 'center', marginTop: 32},
  card: {backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155'},
  cardRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  cardTitle: {color: '#ffffff', fontSize: 16, fontWeight: '600'},
  cardSubtitle: {color: '#94a3b8', fontSize: 13, marginTop: 4},
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
