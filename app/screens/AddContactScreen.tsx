import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  type KeyboardTypeOptions,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import type {ContactInput} from '../types/contact';
import {createContact, updateContact, getContactById} from '../lib/contacts';

type AddContactRouteProp = RouteProp<RootStackParamList, 'AddContact'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TextField = Exclude<keyof ContactInput, 'favorite' | 'spend_limit'> | 'spend_limit';

interface FieldConfig {
  key: TextField;
  label: string;
  placeholder: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'characters';
  multiline?: boolean;
}

const SECTIONS: {title?: string; fields: FieldConfig[]}[] = [
  {
    fields: [
      {key: 'name', label: 'Nombre completo *', placeholder: 'Ej: María López', autoCapitalize: 'words'},
      {
        key: 'nickname',
        label: 'Nickname para Reapli',
        placeholder: 'Ej: mamá, abuela, equipo diseño',
        hint: 'Úsalo en el chat: "mándale café a papá"',
        autoCapitalize: 'none',
      },
      {key: 'email', label: 'Email', placeholder: 'maria@ejemplo.com', keyboardType: 'email-address', autoCapitalize: 'none'},
      {
        key: 'phone',
        label: 'Teléfono (requerido para envíos)',
        placeholder: '+5215512345678',
        hint: 'Formato internacional con +',
        keyboardType: 'phone-pad',
      },
    ],
  },
  {
    title: '📦 Dirección de envío',
    fields: [
      {key: 'address_line1', label: 'Calle y número', placeholder: 'Av. Reforma 123'},
      {key: 'address_line2', label: 'Interior / colonia', placeholder: 'Depto 4, Col. Juárez'},
      {key: 'city', label: 'Ciudad', placeholder: 'Ciudad de México', autoCapitalize: 'words'},
      {key: 'region', label: 'Estado', placeholder: 'CDMX', autoCapitalize: 'words'},
      {key: 'postal_code', label: 'Código postal', placeholder: '06600', keyboardType: 'number-pad'},
      {key: 'country', label: 'País (código ISO)', placeholder: 'MX', autoCapitalize: 'characters'},
    ],
  },
  {
    title: '💰 Presupuesto',
    fields: [
      {
        key: 'spend_limit',
        label: 'Tope por compra',
        placeholder: '500',
        hint: 'Reapli no podrá cobrar más que esto para este contacto',
        keyboardType: 'decimal-pad',
      },
      {key: 'currency', label: 'Moneda', placeholder: 'MXN', autoCapitalize: 'characters'},
      {key: 'notes', label: 'Notas', placeholder: 'Talla, marcas preferidas, alergias...', multiline: true},
    ],
  },
];

export default function AddContactScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AddContactRouteProp>();
  const contactId = route.params?.contactId;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!contactId);
  const [values, setValues] = useState<Partial<Record<TextField, string>>>({currency: 'MXN', country: 'MX'});
  const [favorite, setFavorite] = useState(false);

  const setField = (key: TextField, value: string) => setValues(prev => ({...prev, [key]: value}));

  const loadContact = useCallback(async () => {
    try {
      const contact = await getContactById(contactId!);
      if (contact) {
        const loaded: Partial<Record<TextField, string>> = {};
        SECTIONS.flatMap(section => section.fields).forEach(({key}) => {
          const value = contact[key as keyof typeof contact];
          if (value !== null && value !== undefined) loaded[key] = String(value);
        });
        setValues(loaded);
        setFavorite(contact.favorite);
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el contacto');
    } finally {
      setLoadingData(false);
    }
  }, [contactId]);

  useEffect(() => {
    if (contactId) loadContact();
  }, [contactId, loadContact]);

  const handleSave = async () => {
    if (!values.name?.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del contacto');
      return;
    }
    const spendLimit = values.spend_limit ? Number(values.spend_limit) : undefined;
    if (spendLimit !== undefined && !(spendLimit > 0)) {
      Alert.alert('Error', 'El tope por compra debe ser un número mayor a 0');
      return;
    }

    const input: ContactInput = {
      ...(values as Record<string, string>),
      name: values.name,
      spend_limit: spendLimit,
      favorite,
    };

    setLoading(true);
    try {
      if (contactId) {
        await updateContact(contactId, input);
      } else {
        await createContact(input);
      }
      Alert.alert('Éxito', contactId ? 'Contacto actualizado' : 'Contacto agregado', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (error: any) {
      console.error('Error saving contact:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar el contacto');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{contactId ? 'Editar Contacto' : 'Nuevo Contacto'}</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Reapli usa la dirección para cotizar envíos y respeta el tope por compra al cobrar.
          </Text>
        </View>

        <View style={styles.form}>
          {SECTIONS.map(section => (
            <View key={section.title || 'basic'}>
              {section.title && <Text style={[styles.label, styles.sectionTitle]}>{section.title}</Text>}
              {section.fields.map(field => (
                <View key={field.key} style={styles.inputGroup}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, field.multiline && styles.textArea]}
                    value={values[field.key] || ''}
                    onChangeText={text => setField(field.key, text)}
                    placeholder={field.placeholder}
                    placeholderTextColor="#64748b"
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.autoCapitalize ?? 'sentences'}
                    autoCorrect={false}
                    multiline={field.multiline}
                    numberOfLines={field.multiline ? 3 : undefined}
                  />
                  {field.hint && <Text style={styles.hint}>{field.hint}</Text>}
                </View>
              ))}
            </View>
          ))}

          <View style={styles.switchGroup}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>⭐ Marcar como favorito</Text>
              <Text style={styles.hint}>Los favoritos aparecen primero en la lista</Text>
            </View>
            <Switch
              value={favorite}
              onValueChange={setFavorite}
              trackColor={{false: '#334155', true: '#3b82f6'}}
              thumbColor={favorite ? '#ffffff' : '#94a3b8'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>{contactId ? '💾 Actualizar Contacto' : '➕ Agregar Contacto'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1e293b',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#93c5fd',
    lineHeight: 20,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  monoInput: {
    fontFamily: 'monospace',
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});

