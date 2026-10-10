/**
 * i18n
 *
 * Idiomas de la app (español / inglés). La preferencia se guarda en el dispositivo
 * y Reapli también puede cambiarla cuando el usuario se lo pide en el chat.
 */

import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'es' | 'en';

const STORAGE_KEY = 'language';

const es = {
  common: {
    error: 'Error',
    ok: 'OK',
    cancel: 'Cancelar',
    success: 'Éxito',
    delete: 'Eliminar',
    language: 'Idioma',
    spanish: 'Español',
    english: 'English',
  },
  login: {
    subtitle: 'Inicia sesión o regístrate con tu correo',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tu@email.com',
    sendCode: 'Enviar código',
    info: 'Te enviaremos un código de 6 dígitos a tu correo. Sin contraseñas.',
    footer: 'Acceso passwordless: más seguro, nada que robar ni olvidar',
    enterEmail: 'Por favor ingresa tu correo electrónico',
    invalidEmail: 'Por favor ingresa un correo electrónico válido',
    codeSentTitle: '¡Código enviado!',
    codeSentBody: 'Revisa tu correo electrónico. Te hemos enviado un código de 6 dígitos.',
  },
  verify: {
    navTitle: 'Verificación',
    back: 'Atrás',
    title: 'Verificación',
    subtitle: 'Ingresa el código enviado a:',
    codeLabel: 'Código de verificación',
    codePlaceholder: 'Ingresa el código',
    hint: 'Copia y pega el código de tu correo electrónico',
    verify: 'Verificar código',
    noCode: '¿No recibiste el código?',
    resend: 'Reenviar',
    changeEmail: '← Cambiar correo',
    expires: '💡 El código expira en 60 minutos',
    enterCode: 'Por favor ingresa el código que recibiste',
    welcomeTitle: '¡Bienvenido!',
    welcomeBody: 'Has iniciado sesión exitosamente',
    invalidCode: 'Código inválido o expirado',
    resentTitle: '¡Código reenviado!',
    resentBody: 'Revisa tu correo electrónico',
  },
  profile: {
    title: 'Mi Perfil',
    changePhoto: 'Cambiar foto',
    account: 'Información de Cuenta',
    email: 'Email',
    userId: 'ID de Usuario',
    lastSignIn: 'Última Conexión',
    paymentMethods: 'Métodos de pago',
    cards: 'Tarjetas',
    cardsSubtitle: 'Tu tarjeta se guarda en Reap y apruebas cada cargo de Reapli',
    seePaymentMethods: 'Ver métodos de pago →',
    settings: 'Configuración',
    notifications: 'Notificaciones',
    privacy: 'Privacidad y Seguridad',
    help: 'Ayuda y Soporte',
    signOutTitle: 'Cerrar sesión',
    signOutConfirm: '¿Estás seguro que deseas cerrar sesión?',
    signOutYes: 'Sí, cerrar sesión',
    signingOut: 'Cerrando sesión...',
    signOut: '🚪 Cerrar sesión',
  },
  contacts: {
    title: 'Mis Contactos',
    add: '➕ Agregar',
    addContact: '➕ Agregar Contacto',
    emptyTitle: 'No tienes contactos',
    emptyBody: 'Agrega a las personas para quienes Reapli puede comprar, con su dirección de envío',
    noAddress: '📍 Sin dirección de envío',
    cap: 'tope {amount} {currency}',
    loadError: 'No se pudieron cargar los contactos',
    favoriteError: 'No se pudo actualizar el favorito',
    deleteTitle: 'Eliminar Contacto',
    deleteConfirm: '¿Eliminar a {name}?',
    deleted: 'Contacto eliminado',
    deleteError: 'No se pudo eliminar el contacto',
  },
  contactForm: {
    newTitle: 'Nuevo Contacto',
    editTitle: 'Editar Contacto',
    info: 'Reapli usa la dirección para cotizar envíos y respeta el tope por compra al cobrar.',
    name: 'Nombre completo *',
    namePlaceholder: 'Ej: María López',
    nickname: 'Nickname para Reapli',
    nicknamePlaceholder: 'Ej: mamá, abuela, equipo diseño',
    nicknameHint: 'Úsalo en el chat: "mándale café a papá"',
    email: 'Email',
    phone: 'Teléfono (requerido para envíos)',
    phoneHint: 'Formato internacional con +',
    shipping: '📦 Dirección de envío',
    street: 'Calle y número',
    streetPlaceholder: 'Av. Reforma 123',
    line2: 'Interior / colonia',
    line2Placeholder: 'Depto 4, Col. Juárez',
    city: 'Ciudad',
    cityPlaceholder: 'Ciudad de México',
    region: 'Estado',
    postalCode: 'Código postal',
    country: 'País (código ISO)',
    budget: '💰 Presupuesto',
    cap: 'Tope por compra',
    capHint: 'Reapli no podrá cobrar más que esto para este contacto',
    currency: 'Moneda',
    notes: 'Notas',
    notesPlaceholder: 'Talla, marcas preferidas, alergias...',
    favorite: '⭐ Marcar como favorito',
    favoriteHint: 'Los favoritos aparecen primero en la lista',
    save: '💾 Actualizar Contacto',
    create: '➕ Agregar Contacto',
    loadError: 'No se pudo cargar el contacto',
    nameRequired: 'Por favor ingresa el nombre del contacto',
    capInvalid: 'El tope por compra debe ser un número mayor a 0',
    updated: 'Contacto actualizado',
    created: 'Contacto agregado',
    saveError: 'No se pudo guardar el contacto',
    phoneInvalid: 'El teléfono debe tener formato internacional, ej: +5215512345678',
  },
  payments: {
    title: 'Métodos de pago',
    reapInfo: '🔐 Tu tarjeta se guarda en Reap. Reapli nunca ve sus datos y tú apruebas cada cargo.',
    kwalInfo: '🔗 Reapli paga con una tarjeta respaldada por USDC en tu bóveda de Ink Sepolia. Tú controlas la wallet dueña.',
    empty: 'Aún no tienes tarjetas registradas.',
    addCard: '➕ Agregar tarjeta',
    completeSetup: 'Completar registro',
    cardInProgress: 'Tarjeta en registro',
    vault: 'Bóveda Kwal',
    explorer: 'Ver en explorer',
    usdcFaucet: 'Faucet USDC',
    ethFaucet: 'Faucet ETH',
    status: {
      ACTIVE: 'Activa',
      REQUIRES_ACTION: 'Falta completar',
      REVOKED: 'Revocada',
      FAILED: 'Falló',
      EXPIRED: 'Expiró',
    },
    vaultStatus: {
      READY: '✅ Lista para pagar',
      FUNDS_NEEDED: '💧 Necesita fondos (USDC)',
      PROCESSING: '⏳ Procesando depósito',
      SETUP_NEEDED: '⚙️ Falta configurar con el skill de Kwal',
      ERROR: '🛑 Requiere al operador',
    },
  },
  requests: {
    title: 'Historial de compras',
    tabs: {open: 'Abiertas', completed: 'Compradas', all: 'Todas'},
    totalSpent: 'Total comprado: {amount} USD',
    notQuoted: 'Sin cotizar',
    forMe: 'Para mí',
    product: 'Producto',
    order: 'Orden',
    simulated: ' (simulada)',
    purchasedAt: 'Comprada',
    requestedAt: 'Solicitada',
    cap: 'Tope',
    cancel: 'Cancelar',
    refresh: 'Actualizar estado',
    handleInChat: 'Atender en el chat',
    cancelTitle: 'Cancelar solicitud',
    cancelConfirm: '¿Cancelar "{item}"?',
    no: 'No',
    yesCancel: 'Sí, cancelar',
    emptyTitle: 'Sin solicitudes',
    emptyPurchases: 'Aún no hay compras',
    emptyBody: 'Pídele algo a Reapli en el chat, por ejemplo: "Mándale café a papá"',
    status: {
      pending: 'Pendiente',
      quoted: 'Cotizada',
      awaiting_approval: 'Por aprobar',
      completed: 'Comprada',
      failed: 'Falló',
      expired: 'Expiró',
      cancelled: 'Cancelada',
    },
  },
  chat: {
    subtitle: 'Agente de compras · Transfertronix',
    thinking: '🤖 Reapli está pensando...',
    placeholder: 'Ej: Ana necesita un teclado, máximo 80 USD',
    hint: '🔐 Solo comercios compatibles · tú confirmas cada cargo',
    welcome:
      '¡Hola! Soy Reapli 🤖, tu agente de compras en Transfertronix.\n\n' +
      'Compro lo que tú, tu familia o tu equipo necesiten, dentro del tope que definas, y tú confirmas cada cargo.\n\n' +
      'Ejemplos:\n' +
      '⌨️ "Ana necesita un teclado inalámbrico, máximo 80 dólares"\n' +
      '☕ "Mándale café de especialidad a mi papá"\n' +
      '📦 "Atiende lo que pidió Olivia"\n' +
      '📋 "¿Cómo van mis pedidos?"\n' +
      '🌐 "Speak English"',
    clearTitle: 'Borrar historial',
    clearConfirm: '¿Borrar toda la conversación con Reapli?',
    clear: 'Borrar',
    genericError: 'Lo siento, hubo un error procesando tu mensaje. ¿Podrías intentarlo de nuevo?',
    statusLabels: {
      pending: '🕐 Pendiente',
      quoted: '🧾 Cotizada',
      awaiting_approval: '⏳ Esperando aprobación',
      completed: '✅ Comprada',
      failed: '❌ Falló',
      expired: '⌛ Expiró',
      cancelled: '🚫 Cancelada',
    },
    needPaymentMethod: 'Agregar método de pago',
    seeVault: 'Ver bóveda',
    seePaymentMethods: 'Ver métodos de pago',
    cardReturned: '💳 Volviste de registrar tu tarjeta. Revisa su estado en Métodos de pago.',
    purchaseConfirmed: '✅ ¡Compra confirmada!',
    for: 'Para',
    you: 'ti',
    order: 'Orden',
    simulatedPurchase: '⚠️ Compra simulada (sandbox de Reap sin cotizaciones)',
    purchaseStatus: 'Estado de la compra: {status}',
    paymentPolling: '⏳ La bóveda está pagando, te aviso cuando se confirme...',
    confirmTitle: '🛒 Confirmar compra',
    approveReap: 'Aprobar en Reap',
    payVault: 'Pagar con bóveda',
    reapApprovalNote: 'Aprobarás el cargo en la página segura de Reap.',
    vaultApprovalNote: 'Se pagará con la tarjeta respaldada por tu bóveda USDC.',
    cancelled: 'Compra cancelada.',
    approved: '✅ Cargo aprobado.',
    openedReap: '🔐 Abrí la página de aprobación de Reap. Cuando termines, regresa a la app.',
    quoting: '⏳ Cotizando "{name}"...',
    searching: '🔎 Buscando "{query}"...',
    noResults: 'No encontré opciones disponibles en los comercios compatibles. Prueba con otra descripción.',
    options: 'Encontré estas opciones:',
    overCap: '⚠️ Excede el tope',
    capLine: '💰 Tope: {amount}',
    overCapHelp: 'Busca otra opción o sube el tope.',
    compatibleMerchant: 'Comercio compatible',
    choose: 'Elegir {n}',
    contactNotFound: 'No encontré a "{name}" en tus contactos.',
    addContact: 'Agregar contacto',
    missingAddress: '{name} no tiene dirección de envío completa.',
    completeAddress: 'Completar dirección',
    noPending: '{name} no tiene solicitudes pendientes.',
    noRequests: '📋 No hay solicitudes por ahora.',
    requestsTitle: '📋 Solicitudes ({count}):',
    seeAll: 'Ver todas',
    languageChanged: '🌐 Listo, ahora te hablo en español.',
    subtotal: 'Subtotal',
    shipping: 'Envío',
    taxes: 'Impuestos',
    total: 'Total',
    simulatedQuote: '⚠️ Cotización simulada: el sandbox de Reap no pudo cotizar',
    connectionError: 'No pude conectarme con Reapli. 🤔\n\nIntenta de nuevo en un momento, o usa los botones 📋 👥 💳 de arriba.',
  },
};

type Dictionary = typeof es;

const en: Dictionary = {
  common: {
    error: 'Error',
    ok: 'OK',
    cancel: 'Cancel',
    success: 'Success',
    delete: 'Delete',
    language: 'Language',
    spanish: 'Español',
    english: 'English',
  },
  login: {
    subtitle: 'Sign in or sign up with your email',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    sendCode: 'Send code',
    info: "We'll email you a 6-digit code. No passwords.",
    footer: 'Passwordless sign-in: safer, nothing to steal or forget',
    enterEmail: 'Please enter your email',
    invalidEmail: 'Please enter a valid email',
    codeSentTitle: 'Code sent!',
    codeSentBody: 'Check your email. We sent you a 6-digit code.',
  },
  verify: {
    navTitle: 'Verification',
    back: 'Back',
    title: 'Verification',
    subtitle: 'Enter the code sent to:',
    codeLabel: 'Verification code',
    codePlaceholder: 'Enter the code',
    hint: 'Copy and paste the code from your email',
    verify: 'Verify code',
    noCode: "Didn't get the code?",
    resend: 'Resend',
    changeEmail: '← Change email',
    expires: '💡 The code expires in 60 minutes',
    enterCode: 'Please enter the code you received',
    welcomeTitle: 'Welcome!',
    welcomeBody: 'You signed in successfully',
    invalidCode: 'Invalid or expired code',
    resentTitle: 'Code resent!',
    resentBody: 'Check your email',
  },
  profile: {
    title: 'My Profile',
    changePhoto: 'Change photo',
    account: 'Account',
    email: 'Email',
    userId: 'User ID',
    lastSignIn: 'Last sign-in',
    paymentMethods: 'Payment methods',
    cards: 'Cards',
    cardsSubtitle: 'Your card is stored by Reap and you approve every charge Reapli makes',
    seePaymentMethods: 'See payment methods →',
    settings: 'Settings',
    notifications: 'Notifications',
    privacy: 'Privacy & Security',
    help: 'Help & Support',
    signOutTitle: 'Sign out',
    signOutConfirm: 'Are you sure you want to sign out?',
    signOutYes: 'Yes, sign out',
    signingOut: 'Signing out...',
    signOut: '🚪 Sign out',
  },
  contacts: {
    title: 'My Contacts',
    add: '➕ Add',
    addContact: '➕ Add Contact',
    emptyTitle: 'No contacts yet',
    emptyBody: 'Add the people Reapli can shop for, with their shipping address',
    noAddress: '📍 No shipping address',
    cap: 'cap {amount} {currency}',
    loadError: "Couldn't load contacts",
    favoriteError: "Couldn't update favorite",
    deleteTitle: 'Delete Contact',
    deleteConfirm: 'Delete {name}?',
    deleted: 'Contact deleted',
    deleteError: "Couldn't delete the contact",
  },
  contactForm: {
    newTitle: 'New Contact',
    editTitle: 'Edit Contact',
    info: 'Reapli uses the address to quote shipping and enforces the per-purchase cap when charging.',
    name: 'Full name *',
    namePlaceholder: 'e.g. Maria Lopez',
    nickname: 'Nickname for Reapli',
    nicknamePlaceholder: 'e.g. mom, grandma, design team',
    nicknameHint: 'Use it in the chat: "send dad some coffee"',
    email: 'Email',
    phone: 'Phone (required for shipping)',
    phoneHint: 'International format with +',
    shipping: '📦 Shipping address',
    street: 'Street and number',
    streetPlaceholder: '123 Main St',
    line2: 'Apt / neighborhood',
    line2Placeholder: 'Apt 4',
    city: 'City',
    cityPlaceholder: 'Mexico City',
    region: 'State',
    postalCode: 'Postal code',
    country: 'Country (ISO code)',
    budget: '💰 Budget',
    cap: 'Per-purchase cap',
    capHint: 'Reapli will never charge more than this for this contact',
    currency: 'Currency',
    notes: 'Notes',
    notesPlaceholder: 'Size, favorite brands, allergies...',
    favorite: '⭐ Mark as favorite',
    favoriteHint: 'Favorites show up first',
    save: '💾 Update Contact',
    create: '➕ Add Contact',
    loadError: "Couldn't load the contact",
    nameRequired: "Please enter the contact's name",
    capInvalid: 'The per-purchase cap must be a number greater than 0',
    updated: 'Contact updated',
    created: 'Contact added',
    saveError: "Couldn't save the contact",
    phoneInvalid: 'The phone must use international format, e.g. +5215512345678',
  },
  payments: {
    title: 'Payment methods',
    reapInfo: '🔐 Your card is stored by Reap. Reapli never sees it and you approve every charge.',
    kwalInfo: '🔗 Reapli pays with a card backed by USDC in your Ink Sepolia vault. You control the owner wallet.',
    empty: "You don't have any cards yet.",
    addCard: '➕ Add card',
    completeSetup: 'Finish setup',
    cardInProgress: 'Card being set up',
    vault: 'Kwal vault',
    explorer: 'View on explorer',
    usdcFaucet: 'USDC faucet',
    ethFaucet: 'ETH faucet',
    status: {
      ACTIVE: 'Active',
      REQUIRES_ACTION: 'Needs action',
      REVOKED: 'Revoked',
      FAILED: 'Failed',
      EXPIRED: 'Expired',
    },
    vaultStatus: {
      READY: '✅ Ready to pay',
      FUNDS_NEEDED: '💧 Needs funds (USDC)',
      PROCESSING: '⏳ Processing deposit',
      SETUP_NEEDED: '⚙️ Set it up with the Kwal skill',
      ERROR: '🛑 Needs the operator',
    },
  },
  requests: {
    title: 'Purchase history',
    tabs: {open: 'Open', completed: 'Purchased', all: 'All'},
    totalSpent: 'Total purchased: {amount} USD',
    notQuoted: 'Not quoted',
    forMe: 'For me',
    product: 'Product',
    order: 'Order',
    simulated: ' (simulated)',
    purchasedAt: 'Purchased',
    requestedAt: 'Requested',
    cap: 'Cap',
    cancel: 'Cancel',
    refresh: 'Refresh status',
    handleInChat: 'Handle in chat',
    cancelTitle: 'Cancel request',
    cancelConfirm: 'Cancel "{item}"?',
    no: 'No',
    yesCancel: 'Yes, cancel',
    emptyTitle: 'No requests',
    emptyPurchases: 'No purchases yet',
    emptyBody: 'Ask Reapli for something in the chat, e.g. "Send dad some coffee"',
    status: {
      pending: 'Pending',
      quoted: 'Quoted',
      awaiting_approval: 'Awaiting approval',
      completed: 'Purchased',
      failed: 'Failed',
      expired: 'Expired',
      cancelled: 'Cancelled',
    },
  },
  chat: {
    subtitle: 'Shopping agent · Transfertronix',
    thinking: '🤖 Reapli is thinking...',
    placeholder: 'e.g. Ana needs a keyboard, max 80 USD',
    hint: '🔐 Supported merchants only · you confirm every charge',
    welcome:
      "Hi! I'm Reapli 🤖, your shopping agent in Transfertronix.\n\n" +
      'I buy what you, your family or your team need, within the cap you set, and you confirm every charge.\n\n' +
      'Examples:\n' +
      '⌨️ "Ana needs a wireless keyboard, max 80 dollars"\n' +
      '☕ "Send my dad some specialty coffee"\n' +
      '📦 "Handle Olivia\'s request"\n' +
      '📋 "How are my orders doing?"\n' +
      '🌐 "Habla en español"',
    clearTitle: 'Clear history',
    clearConfirm: 'Delete the whole conversation with Reapli?',
    clear: 'Delete',
    genericError: 'Sorry, something went wrong processing your message. Could you try again?',
    statusLabels: {
      pending: '🕐 Pending',
      quoted: '🧾 Quoted',
      awaiting_approval: '⏳ Awaiting approval',
      completed: '✅ Purchased',
      failed: '❌ Failed',
      expired: '⌛ Expired',
      cancelled: '🚫 Cancelled',
    },
    needPaymentMethod: 'Add payment method',
    seeVault: 'See vault',
    seePaymentMethods: 'See payment methods',
    cardReturned: '💳 You are back from setting up your card. Check its status in Payment methods.',
    purchaseConfirmed: '✅ Purchase confirmed!',
    for: 'For',
    you: 'you',
    order: 'Order',
    simulatedPurchase: '⚠️ Simulated purchase (Reap sandbox could not quote)',
    purchaseStatus: 'Purchase status: {status}',
    paymentPolling: "⏳ The vault is paying, I'll let you know once it's confirmed...",
    confirmTitle: '🛒 Confirm purchase',
    approveReap: 'Approve in Reap',
    payVault: 'Pay with vault',
    reapApprovalNote: "You'll approve the charge on Reap's secure page.",
    vaultApprovalNote: 'It will be paid with the card backed by your USDC vault.',
    cancelled: 'Purchase cancelled.',
    approved: '✅ Charge approved.',
    openedReap: "🔐 I opened Reap's approval page. Come back to the app when you're done.",
    quoting: '⏳ Quoting "{name}"...',
    searching: '🔎 Searching "{query}"...',
    noResults: "I couldn't find options at supported merchants. Try a different description.",
    options: 'I found these options:',
    overCap: '⚠️ Over the cap',
    capLine: '💰 Cap: {amount}',
    overCapHelp: 'Pick another option or raise the cap.',
    compatibleMerchant: 'Supported merchant',
    choose: 'Pick {n}',
    contactNotFound: 'I couldn\'t find "{name}" in your contacts.',
    addContact: 'Add contact',
    missingAddress: "{name} doesn't have a complete shipping address.",
    completeAddress: 'Complete address',
    noPending: '{name} has no pending requests.',
    noRequests: '📋 No requests yet.',
    requestsTitle: '📋 Requests ({count}):',
    seeAll: 'See all',
    languageChanged: "🌐 Done, I'll speak English from now on.",
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    taxes: 'Taxes',
    total: 'Total',
    simulatedQuote: '⚠️ Simulated quote: the Reap sandbox could not quote',
    connectionError: "I couldn't reach Reapli. 🤔\n\nTry again in a moment, or use the 📋 👥 💳 buttons above.",
  },
};

const dictionaries: Record<Language, Dictionary> = {es, en};

let currentLanguage: Language = 'es';

/** Idioma vigente para código fuera de React (cliente HTTP, agente). */
export function getLanguage(): Language {
  return currentLanguage;
}

function deviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    return locale.toLowerCase().startsWith('en') ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function lookup(dict: Dictionary, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node == null ? node : node[part]), dict);
}

export function translate(language: Language, key: string, vars: Record<string, string | number> = {}): string {
  const value = lookup(dictionaries[language], key) ?? lookup(es, key);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
}

const I18nContext = createContext<I18nValue>({
  language: 'es',
  setLanguage: () => {},
  t: (key, vars) => translate('es', key, vars),
  locale: 'es-MX',
});

export function LanguageProvider({children}: {children: React.ReactNode}) {
  const [language, setLanguageState] = useState<Language>(() => {
    currentLanguage = deviceLanguage();
    return currentLanguage;
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (saved === 'es' || saved === 'en') {
          currentLanguage = saved;
          setLanguageState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((next: Language) => {
    currentLanguage = next;
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
      locale: language === 'en' ? 'en-US' : 'es-MX',
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
