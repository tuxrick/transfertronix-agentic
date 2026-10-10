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
import type {RootStackParamList} from '../types/navigation';
import type {Contact} from '../types/contact';
import type {PaymentProviderName, Product, Quote} from '../types/commerce';
import type {PurchaseRequest} from '../types/purchaseRequest';
import {processMessageWithAI, type ChatTurn, type FunctionCall, type ShippingCatalog} from '../lib/geminiAgent';
import {getContacts, findContact, hasShippingAddress} from '../lib/contacts';
import {getMerchants, getPaymentSetup, searchProducts, ApiError} from '../lib/commerceApi';
import {
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  quotePurchase,
  startCheckout,
  syncCheckout,
} from '../lib/purchaseRequests';
import {clearChatHistory, loadChatHistory, saveChatMessage} from '../lib/chatHistory';
import {translate, useI18n, type Language} from '../lib/i18n';

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
const DEFAULT_COUNTRY = 'MX';
const PAYMENT_POLL_ATTEMPTS = 12;
const PAYMENT_POLL_INTERVAL_MS = 5000;


function getQueryParam(url: string, key: string): string | undefined {
  const match = url.match(new RegExp(`[?&]${key}=([^&#]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function formatMoney(amount: number, currency: string) {
  return `${amount.toFixed(2)} ${currency}`;
}

function formatQuote(quote: Quote, t: (key: string) => string) {
  const lines: string[] = [];
  if (quote.subtotal) lines.push(`${t('chat.subtotal')}: ${formatMoney(quote.subtotal.amount, quote.subtotal.currency)}`);
  if (quote.shipping) lines.push(`${t('chat.shipping')}: ${formatMoney(quote.shipping.amount, quote.shipping.currency)}`);
  if (quote.tax) lines.push(`${t('chat.taxes')}: ${formatMoney(quote.tax.amount, quote.tax.currency)}`);
  quote.discounts.forEach(d => lines.push(`${d.name}: -${formatMoney(d.amount.amount, d.amount.currency)}`));
  lines.push(`\n${t('chat.total')}: ${formatMoney(quote.total.amount, quote.total.currency)}`);
  if (quote.demo) lines.push(`\n${t('chat.simulatedQuote')}`);
  return lines.join('\n');
}

function welcomeMessage(text: string): Message {
  return {id: 'welcome', text, sender: 'ai', timestamp: new Date()};
}

// Gemini needs the history to start with a user turn and only carries text.
function toGeminiHistory(stored: {sender: 'user' | 'ai'; text: string}[]): ChatTurn[] {
  const turns: ChatTurn[] = stored.slice(-MAX_HISTORY_TURNS * 2).map(m => ({
    role: m.sender === 'user' ? 'user' : 'model',
    text: m.text,
  }));
  const firstUser = turns.findIndex(t => t.role === 'user');
  return firstUser === -1 ? [] : turns.slice(firstUser);
}

export default function ChatScreen({navigation}: Props) {
  const {t, language, setLanguage, locale} = useI18n();
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMessage(t('chat.welcome'))]);
  const [inputText, setInputText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openRequests, setOpenRequests] = useState<PurchaseRequest[]>([]);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [provider, setProvider] = useState<PaymentProviderName>();
  const [shippingCatalog, setShippingCatalog] = useState<ShippingCatalog[]>([]);
  const historyRef = useRef<ChatTurn[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const loadContext = useCallback(async () => {
    try {
      const [contactsData, requestsData] = await Promise.all([
        getContacts(),
        getPurchaseRequests(OPEN_STATUSES),
      ]);
      setContacts(contactsData);
      setOpenRequests(requestsData);

      const countries = [...new Set([DEFAULT_COUNTRY, ...contactsData.map(c => c.country).filter(Boolean)])] as string[];
      const [setup, ...catalogs] = await Promise.all([
        getPaymentSetup().catch(() => undefined),
        ...countries.map(country => getMerchants(country).catch(() => undefined)),
      ]);
      setHasPaymentMethod(Boolean(setup?.ready));
      setProvider(setup?.provider);
      setShippingCatalog(
        countries.map((country, i) => ({
          country,
          categories: (catalogs[i] as Awaited<ReturnType<typeof getMerchants>> | undefined)?.categories.map(c => c.name) || [],
        })),
      );
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
      // Quick status lines (skipDelay) are transient; the rest is kept as history.
      if (!options.skipDelay) saveChatMessage(sender, text);
    },
    [],
  );

  useEffect(() => {
    loadChatHistory().then(stored => {
      if (stored.length === 0) return;
      historyRef.current = toGeminiHistory(stored);
      setMessages([
        welcomeMessage(t('chat.welcome')),
        ...stored.map(m => ({id: m.id, text: m.text, sender: m.sender, timestamp: new Date(m.created_at)})),
      ]);
    });
  }, []);

  useEffect(() => {
    setMessages(prev => prev.map(m => (m.id === 'welcome' ? {...m, text: t('chat.welcome')} : m)));
  }, [t]);

  const confirmClearHistory = () => {
    Alert.alert(t('chat.clearTitle'), t('chat.clearConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('chat.clear'),
        style: 'destructive',
        onPress: async () => {
          try {
            await clearChatHistory();
            historyRef.current = [];
            setMessages([welcomeMessage(t('chat.welcome'))]);
          } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
          }
        },
      },
    ]);
  };

  const reportError = useCallback(
    async (error: unknown) => {
      if (error instanceof ApiError && error.code === 'NO_PAYMENT_METHOD') {
        await addMessage(`💳 ${error.message}.`, 'ai', {
          actions: [{label: t('chat.needPaymentMethod'), onPress: () => navigation.navigate('PaymentMethods')}],
        });
        return;
      }
      if (error instanceof ApiError && error.code === 'INSUFFICIENT_FUNDS') {
        await addMessage(`💧 ${error.message}.`, 'ai', {
          actions: [{label: t('chat.seeVault'), onPress: () => navigation.navigate('PaymentMethods')}],
        });
        return;
      }
      if (error instanceof ApiError && error.code === 'BUDGET_CURRENCY_MISMATCH') {
        await addMessage(`💱 ${error.message}.`, 'ai');
        return;
      }
      if (error instanceof ApiError && error.code === 'BUDGET_EXCEEDED') {
        await addMessage(`🛑 ${error.message}. ${t('chat.overCapHelp')}`, 'ai');
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
        await addMessage(t('chat.cardReturned'), 'ai', {
          actions: [{label: t('chat.seePaymentMethods'), onPress: () => navigation.navigate('PaymentMethods')}],
        });
        return;
      }
      if (kind !== 'checkout' || !ref) return;

      try {
        const request = await getPurchaseRequestById(ref);
        if (!request) return;
        const synced = await syncCheckout(request);
        if (synced.status === 'completed') {
          await addMessage(
            `${t('chat.purchaseConfirmed')}\n\n📦 ${synced.product_snapshot?.name || synced.item_description}\n` +
              `👤 ${t('chat.for')}: ${synced.contact_name || t('chat.you')}\n` +
              `💰 ${formatMoney(synced.final_amount ?? synced.quoted_amount ?? 0, synced.currency)}\n` +
              `🧾 ${t('chat.order')}: ${synced.order_id}` +
              (synced.product_snapshot?.demo ? `\n\n${t('chat.simulatedPurchase')}` : ''),
            'ai',
          );
        } else {
          await addMessage(t('chat.purchaseStatus', {status: t(`chat.statusLabels.${synced.status}`)}), 'ai');
        }
        await loadContext();
      } catch (error) {
        await reportError(error);
      }
    },
    [addMessage, loadContext, navigation, reportError],
  );

  useEffect(() => {
    Linking.getInitialURL().then(handleReturnUrl);
    const subscription = Linking.addEventListener('url', ({url}) => handleReturnUrl(url));
    return () => subscription.remove();
  }, [handleReturnUrl]);

  // Kwal no regresa por deep link: se consulta el pago hasta que termine.
  const pollPayment = async (request: PurchaseRequest) => {
    let current = request;
    for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS && current.status === 'awaiting_approval'; attempt++) {
      await new Promise<void>(resolve => setTimeout(resolve, PAYMENT_POLL_INTERVAL_MS));
      current = await syncCheckout(current);
    }
    await handleReturnUrl(`transfertronix://agentic/return?kind=checkout&ref=${current.id}`);
  };

  const confirmAndCheckout = async (request: PurchaseRequest, quote: Quote, product: Product) => {
    const isReap = provider === 'reap';
    Alert.alert(
      t('chat.confirmTitle'),
      `${product.name}\n${product.merchant || ''}\n\n` +
        `👤 ${t('chat.for')}: ${request.contact_name || t('chat.you')}\n\n${formatQuote(quote, t)}\n\n` +
        (isReap
          ? t('chat.reapApprovalNote')
          : t('chat.vaultApprovalNote')),
      [
        {text: t('common.cancel'), style: 'cancel', onPress: () => addMessage(t('chat.cancelled'), 'ai', {skipDelay: true})},
        {
          text: isReap ? t('chat.approveReap') : t('chat.payVault'),
          onPress: async () => {
            try {
              const updated = await startCheckout(request);
              if (updated.status === 'completed') {
                await handleReturnUrl(`transfertronix://agentic/return?kind=checkout&ref=${updated.id}`);
              } else if (isReap) {
                await addMessage(t('chat.openedReap'), 'ai');
              } else {
                await addMessage(t('chat.paymentPolling'), 'ai');
                await pollPayment(updated);
              }
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
      await addMessage(t('chat.quoting', {name: product.name}), 'ai', {skipDelay: true});
      const {request: quoted, quote} = await quotePurchase(request, product, contact);
      await confirmAndCheckout(quoted, quote, product);
    } catch (error) {
      await reportError(error);
    }
  };

  const searchOptions = async (request: PurchaseRequest, contact?: Contact) => {
    await addMessage(t('chat.searching', {query: request.item_description}), 'ai', {skipDelay: true});
    const result = await searchProducts({
      query: request.item_description,
      country: contact?.country || DEFAULT_COUNTRY,
      currency: request.currency,
      // No price filter: options over the cap are shown flagged and the server blocks them at checkout.
      limit: 3,
    });

    if (result.products.length === 0) {
      await addMessage(t('chat.noResults'), 'ai');
      return;
    }

    const overCap = (p: Product) =>
      Boolean(
        request.max_amount && p.price && p.price.currency === (request.max_currency || request.currency) &&
          p.price.amount > Number(request.max_amount),
      );
    const lines = result.products.map((p, i) => {
      const price = p.price ? ` · ${formatMoney(p.price.amount, p.price.currency)}` : '';
      const flag = overCap(p) ? `\n   ${t('chat.overCap')}` : '';
      return `${i + 1}. ${p.name}\n   ${p.merchant || t('chat.compatibleMerchant')}${price}${flag}`;
    });
    const cap = request.max_amount
      ? `\n\n${t('chat.capLine', {amount: formatMoney(Number(request.max_amount), request.max_currency || request.currency)})}`
      : '';
    await addMessage(`${t('chat.options')}\n\n${lines.join('\n\n')}${cap}`, 'ai', {
      actions: result.products.map((p, i) => ({
        label: t('chat.choose', {n: i + 1}),
        onPress: () => selectProduct(request, p, contact),
      })),
    });
  };

  const resolveContact = async (name?: string): Promise<Contact | undefined | null> => {
    if (!name) return undefined;
    const contact = findContact(contacts, name);
    if (!contact) {
      await addMessage(t('chat.contactNotFound', {name}), 'ai', {
        actions: [{label: t('chat.addContact'), onPress: () => navigation.navigate('AddContact')}],
      });
      return null;
    }
    if (!hasShippingAddress(contact)) {
      await addMessage(t('chat.missingAddress', {name: contact.name}), 'ai', {
        actions: [{label: t('chat.completeAddress'), onPress: () => navigation.navigate('AddContact', {contactId: contact.id})}],
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
      max_currency: args.max_amount ? args.currency || 'MXN' : contact?.currency,
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
      await addMessage(t('chat.noPending', {name: contact.name}), 'ai');
      return;
    }
    await searchOptions(request, contact);
  };

  const handleListPurchaseRequests = async (args: FunctionCall['args'] = {}) => {
    const filter = args.status === 'completed' ? 'completed' : args.status === 'all' ? undefined : OPEN_STATUSES;
    const requests = await getPurchaseRequests(filter);
    if (requests.length === 0) {
      await addMessage(t('chat.noRequests'), 'ai');
      return;
    }
    const lines = requests.slice(0, 10).map(r => {
      const amount = r.final_amount ?? r.quoted_amount;
      return (
        `${t(`chat.statusLabels.${r.status}`)} · ${r.contact_name || t('requests.forMe')}\n   ${r.item_description}` +
        (amount ? ` · ${formatMoney(amount, r.currency)}` : '')
      );
    });
    await addMessage(`${t('chat.requestsTitle', {count: requests.length})}\n\n${lines.join('\n\n')}`, 'ai', {
      actions: [{label: t('chat.seeAll'), onPress: () => navigation.navigate('PurchaseRequests')}],
    });
  };

  const handleSetLanguage = async (args: FunctionCall['args']) => {
    const next: Language = args.language === 'en' ? 'en' : 'es';
    setLanguage(next);
    await addMessage(translate(next, 'chat.languageChanged'), 'ai');
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
        case 'set_language':
          return await handleSetLanguage(functionCall.args);
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
        {contacts, openRequests, hasPaymentMethod, provider, shippingCatalog, language},
        historyRef.current,
      );

      const modelTurn = aiResponse.functionCall
        ? `[acción: ${aiResponse.functionCall.name} ${JSON.stringify(aiResponse.functionCall.args)}]`
        : aiResponse.text;
      historyRef.current = [
        ...historyRef.current,
        {role: 'user' as const, text: userMessage},
        {role: 'model' as const, text: modelTurn},
      ].slice(-MAX_HISTORY_TURNS * 2);

      if (aiResponse.functionCall) {
        await handleFunctionCall(aiResponse.functionCall);
      } else if (aiResponse.text.trim()) {
        await addMessage(aiResponse.text, 'ai');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage(t('chat.genericError'), 'ai');
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
              {item.timestamp.toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'})}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onLongPress={confirmClearHistory} activeOpacity={0.8}>
          <Text style={styles.headerTitle}>Reapli</Text>
          <Text style={styles.headerSubtitle}>{processing ? t('chat.thinking') : t('chat.subtitle')}</Text>
        </TouchableOpacity>
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
              placeholder={t('chat.placeholder')}
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
          <Text style={styles.inputHint}>{t('chat.hint')}</Text>
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
