import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {Content} from '@google/generative-ai';
import type {RootStackParamList} from '../types/navigation';
import type {Contact} from '../types/contact';
import type {Product, Quote} from '../types/reap';
import type {PurchaseRequest} from '../types/purchaseRequest';
import {processMessageWithAI, type FunctionCall} from '../lib/geminiAgent';
import {getContacts, findContact, hasShippingAddress} from '../lib/contacts';
import {getActiveEnrollment, searchProducts, ApiError} from '../lib/reapApi';
import {
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  quotePurchase,
  startCheckout,
  syncCheckout,
} from '../lib/purchaseRequests';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

interface MessageAction {
  label: string;
  onPress: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  actions?: MessageAction[];
}

const OPEN_STATUSES: PurchaseRequest['status'][] = ['pending', 'quoted', 'awaiting_approval'];
const MAX_HISTORY_TURNS = 10;

const STATUS_LABELS: Record<PurchaseRequest['status'], string> = {
  pending: '🕐 Pendiente',
  quoted: '🧾 Cotizada',
  awaiting_approval: '⏳ Esperando aprobación',
  completed: '✅ Comprada',
  failed: '❌ Falló',
  expired: '⌛ Expiró',
  cancelled: '🚫 Cancelada',
};

function getQueryParam(url: string, key: string): string | undefined {
  const match = url.match(new RegExp(`[?&]${key}=([^&#]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function formatMoney(amount: number, currency: string) {
  return `${amount.toFixed(2)} ${currency}`;
}

function formatQuote(quote: Quote) {
  const b = quote.amountBreakdown;
  const lines = [`Subtotal: ${formatMoney(b.itemsSubtotal.amount, b.itemsSubtotal.currency)}`];
  if (b.shipping) lines.push(`Envío: ${formatMoney(b.shipping.amount, b.shipping.currency)}`);
  if (b.tax && !b.tax.includedInPrices) {
    lines.push(`Impuestos: ${formatMoney(b.tax.amount.amount, b.tax.amount.currency)}`);
  }
  b.discounts.forEach(d => lines.push(`${d.name}: -${formatMoney(d.amount.amount, d.amount.currency)}`));
  lines.push(`\nTotal: ${formatMoney(b.finalAmount.amount, b.finalAmount.currency)}`);
  return lines.join('\n');
}

export default function ChatScreen({navigation}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text:
        '¡Hola! Soy Transfertronix 🤖\n\n' +
        'Compro lo que tú o tus contactos necesiten y tú apruebas cada cargo de forma segura con Reap.\n\n' +
        'Ejemplos:\n' +
        '🛒 "Mándale pañales a mi mamá, máximo 600 pesos"\n' +
        '📦 "Atiende lo que pidió Olivia"\n' +
        '📋 "¿Cómo van mis pedidos?"',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openRequests, setOpenRequests] = useState<PurchaseRequest[]>([]);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const historyRef = useRef<Content[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const loadContext = useCallback(async () => {
    try {
      const [contactsData, requestsData] = await Promise.all([
        getContacts(),
        getPurchaseRequests(OPEN_STATUSES),
      ]);
      setContacts(contactsData);
      setOpenRequests(requestsData);
      setHasPaymentMethod(Boolean(await getActiveEnrollment().catch(() => undefined)));
    } catch (error) {
      console.error('Error loading context:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContext();
    }, [loadContext]),
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messages]);

  const addMessage = useCallback(
    async (text: string, sender: 'user' | 'ai', options: {skipDelay?: boolean; actions?: MessageAction[]} = {}) => {
      if (sender === 'ai' && !options.skipDelay) {
        setMessages(prev => [...prev, {id: 'typing', text: '...', sender: 'ai', timestamp: new Date()}]);
        await new Promise<void>(resolve => setTimeout(resolve, 600));
        setMessages(prev => prev.filter(m => m.id !== 'typing'));
      }
      setMessages(prev => [
        ...prev,
        {id: `${Date.now()}-${Math.random()}`, text, sender, timestamp: new Date(), actions: options.actions},
      ]);
    },
    [],
  );

  const reportError = useCallback(
    async (error: unknown) => {
      if (error instanceof ApiError && error.code === 'NO_PAYMENT_METHOD') {
        await addMessage('💳 Necesitas un método de pago antes de comprar.', 'ai', {
          actions: [{label: 'Agregar método de pago', onPress: () => navigation.navigate('PaymentMethods')}],
        });
        return;
      }
      if (error instanceof ApiError && error.code === 'BUDGET_EXCEEDED') {
        await addMessage(`🛑 ${error.message}. Busca otra opción o sube el tope.`, 'ai');
        return;
      }
      await addMessage(`❌ ${(error as Error).message}`, 'ai');
    },
    [addMessage, navigation],
  );

  // Regreso desde la página de aprobación de Reap: transfertronix://agentic/return?kind=checkout&ref=<id>
  const handleReturnUrl = useCallback(
    async (url: string | null) => {
      if (!url?.startsWith('transfertronix://agentic/return')) return;
      const kind = getQueryParam(url, 'kind');
      const ref = getQueryParam(url, 'ref');

      if (kind === 'enrollment') {
        await loadContext();
        await addMessage('💳 Volviste de registrar tu tarjeta. Revisa su estado en Métodos de pago.', 'ai');
        return;
      }
      if (kind !== 'checkout' || !ref) return;

      try {
        const request = await getPurchaseRequestById(ref);
        if (!request) return;
        const synced = await syncCheckout(request);
        if (synced.status === 'completed') {
          await addMessage(
            `✅ ¡Compra confirmada!\n\n📦 ${synced.product_snapshot?.name || synced.item_description}\n` +
              `👤 Para: ${synced.contact_name || 'ti'}\n` +
              `💰 ${formatMoney(synced.final_amount ?? synced.quoted_amount ?? 0, synced.currency)}\n` +
              `🧾 Orden: ${synced.order_id}`,
            'ai',
          );
        } else {
          await addMessage(`Estado de la compra: ${STATUS_LABELS[synced.status]}`, 'ai');
        }
        await loadContext();
      } catch (error) {
        await reportError(error);
      }
    },
    [addMessage, loadContext, reportError],
  );

  useEffect(() => {
    Linking.getInitialURL().then(handleReturnUrl);
    const subscription = Linking.addEventListener('url', ({url}) => handleReturnUrl(url));
    return () => subscription.remove();
  }, [handleReturnUrl]);

  const confirmAndCheckout = async (request: PurchaseRequest, quote: Quote, product: Product) => {
    Alert.alert(
      '🛒 Confirmar compra',
      `${product.name}\n${product.merchant.name}\n\n` +
        `👤 Para: ${request.contact_name || 'ti'}\n\n${formatQuote(quote)}\n\n` +
        'Aprobarás el cargo en la página segura de Reap.',
      [
        {text: 'Cancelar', style: 'cancel', onPress: () => addMessage('Compra cancelada.', 'ai', {skipDelay: true})},
        {
          text: 'Aprobar en Reap',
          onPress: async () => {
            try {
              const updated = await startCheckout(request);
              await addMessage(
                updated.status === 'completed'
                  ? '✅ Cargo aprobado.'
                  : '🔐 Abrí la página de aprobación de Reap. Cuando termines, regresa a la app.',
                'ai',
              );
              if (updated.status === 'completed') await handleReturnUrl(`transfertronix://agentic/return?kind=checkout&ref=${updated.id}`);
            } catch (error) {
              await reportError(error);
            }
          },
        },
      ],
    );
  };

  const selectProduct = async (request: PurchaseRequest, product: Product, contact?: Contact) => {
    try {
      await addMessage(`⏳ Cotizando "${product.name}"...`, 'ai', {skipDelay: true});
      const {request: quoted, quote} = await quotePurchase(request, product, contact);
      await confirmAndCheckout(quoted, quote, product);
    } catch (error) {
      await reportError(error);
    }
  };

  const searchOptions = async (request: PurchaseRequest, contact?: Contact) => {
    await addMessage(`🔎 Buscando "${request.item_description}"...`, 'ai', {skipDelay: true});
    const result = await searchProducts({
      query: request.item_description,
      country: contact?.country,
      currency: request.currency,
      maxPrice: request.max_amount,
      limit: 3,
    });

    if (result.products.length === 0) {
      await addMessage('No encontré opciones disponibles en los comercios soportados. Prueba con otra descripción.', 'ai');
      return;
    }

    const lines = result.products.map((p, i) => {
      const price = p.previewVariant?.price || p.priceRange.min;
      return `${i + 1}. ${p.name}\n   ${p.merchant.name} · ${formatMoney(price.amount, price.currency)}`;
    });
    await addMessage(`Encontré estas opciones:\n\n${lines.join('\n\n')}`, 'ai', {
      actions: result.products.map((p, i) => ({
        label: `Elegir ${i + 1}`,
        onPress: () => selectProduct(request, p, contact),
      })),
    });
  };

  const resolveContact = async (name?: string): Promise<Contact | undefined | null> => {
    if (!name) return undefined;
    const contact = findContact(contacts, name);
    if (!contact) {
      await addMessage(`No encontré a "${name}" en tus contactos.`, 'ai', {
        actions: [{label: 'Agregar contacto', onPress: () => navigation.navigate('AddContact')}],
      });
      return null;
    }
    if (!hasShippingAddress(contact)) {
      await addMessage(`${contact.name} no tiene dirección de envío completa.`, 'ai', {
        actions: [{label: 'Completar dirección', onPress: () => navigation.navigate('AddContact', {contactId: contact.id})}],
      });
      return null;
    }
    return contact;
  };

  const handleCreatePurchaseRequest = async (args: FunctionCall['args']) => {
    const contact = await resolveContact(args.contact);
    if (contact === null) return;

    const request = await createPurchaseRequest({
      contact_id: contact?.id,
      contact_name: contact?.name,
      item_description: args.item_description,
      max_amount: args.max_amount ?? contact?.spend_limit,
      currency: args.currency || contact?.currency || 'MXN',
    });
    await searchOptions(request, contact);
    await loadContext();
  };

  const handleFulfillPurchaseRequest = async (args: FunctionCall['args']) => {
    const contact = await resolveContact(args.contact);
    if (!contact) return;

    const request = openRequests.find(r => r.contact_id === contact.id && r.status !== 'awaiting_approval');
    if (!request) {
      await addMessage(`${contact.name} no tiene solicitudes pendientes.`, 'ai');
      return;
    }
    await searchOptions(request, contact);
  };

  const handleListPurchaseRequests = async (args: FunctionCall['args'] = {}) => {
    const filter = args.status === 'completed' ? 'completed' : args.status === 'all' ? undefined : OPEN_STATUSES;
    const requests = await getPurchaseRequests(filter);
    if (requests.length === 0) {
      await addMessage('📋 No hay solicitudes por ahora.', 'ai');
      return;
    }
    const lines = requests.slice(0, 10).map(r => {
      const amount = r.final_amount ?? r.quoted_amount;
      return (
        `${STATUS_LABELS[r.status]} · ${r.contact_name || 'Tú'}\n   ${r.item_description}` +
        (amount ? ` · ${formatMoney(amount, r.currency)}` : '')
      );
    });
    await addMessage(`📋 Solicitudes (${requests.length}):\n\n${lines.join('\n\n')}`, 'ai', {
      actions: [{label: 'Ver todas', onPress: () => navigation.navigate('PurchaseRequests')}],
    });
  };

  const handleFunctionCall = async (functionCall: FunctionCall) => {
    try {
      switch (functionCall.name) {
        case 'create_purchase_request':
          return await handleCreatePurchaseRequest(functionCall.args);
        case 'fulfill_purchase_request':
          return await handleFulfillPurchaseRequest(functionCall.args);
        case 'list_purchase_requests':
          return await handleListPurchaseRequests(functionCall.args);
        default:
          console.warn('Función desconocida:', functionCall.name);
      }
    } catch (error) {
      await reportError(error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || processing) return;

    const userMessage = inputText.trim();
    setInputText('');
    addMessage(userMessage, 'user');
    setProcessing(true);

    try {
      const aiResponse = await processMessageWithAI(
        userMessage,
        {contacts, openRequests, hasPaymentMethod},
        historyRef.current,
      );

      const modelTurn = aiResponse.functionCall
        ? `[acción: ${aiResponse.functionCall.name} ${JSON.stringify(aiResponse.functionCall.args)}]`
        : aiResponse.text;
      historyRef.current = [
        ...historyRef.current,
        {role: 'user', parts: [{text: userMessage}]},
        {role: 'model', parts: [{text: modelTurn}]},
      ].slice(-MAX_HISTORY_TURNS * 2);

      if (aiResponse.functionCall) {
        await handleFunctionCall(aiResponse.functionCall);
      } else if (aiResponse.text.trim()) {
        await addMessage(aiResponse.text, 'ai');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage('Lo siento, hubo un error procesando tu mensaje. ¿Podrías intentarlo de nuevo?', 'ai');
    } finally {
      setProcessing(false);
    }
  };

  const renderMessage = ({item}: {item: Message}) => {
    const isUser = item.sender === 'user';
    const isTyping = item.id === 'typing';

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.aiMessageContainer]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble, isTyping && styles.typingBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText, isTyping && styles.typingText]}>
            {item.text}
          </Text>
          {item.actions && item.actions.length > 0 && (
            <View style={styles.actionsRow}>
              {item.actions.map(action => (
                <TouchableOpacity key={action.label} style={styles.actionButton} onPress={action.onPress}>
                  <Text style={styles.actionButtonText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!isTyping && (
            <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
              {item.timestamp.toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Transfertronix</Text>
          <Text style={styles.headerSubtitle}>{processing ? '🤖 Procesando...' : 'Agente de compras'}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusIndicator}>
            <View style={[styles.onlineDot, processing && styles.processingDot]} />
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('PurchaseRequests')}>
            <Text style={styles.headerButtonIcon}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Contacts')}>
            <Text style={styles.headerButtonIcon}>👥</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('PaymentMethods')}>
            <Text style={styles.headerButtonIcon}>💳</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ej: Mándale pañales a mi mamá"
              placeholderTextColor="#64748b"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              editable={!processing}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || processing) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || processing}>
              {processing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.sendIcon}>➤</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.inputHint}>🔐 Cada cargo lo apruebas tú en Reap</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    marginRight: 8,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  processingDot: {
    backgroundColor: '#f59e0b',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonIcon: {
    fontSize: 18,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIcon: {
    fontSize: 18,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typingBubble: {
    backgroundColor: '#2d3748',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#e2e8f0',
  },
  typingText: {
    fontSize: 20,
    letterSpacing: 2,
    color: '#94a3b8',
  },
  userMessageText: {
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  userTimestamp: {
    color: '#dbeafe',
  },
  inputContainer: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  sendIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  inputHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
