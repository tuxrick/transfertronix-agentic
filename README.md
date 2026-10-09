# Transfertronix · Reap Agentic Hackathon

Agente de compras conversacional: tú o tus contactos piden algo y el agente busca, cotiza y prepara la compra con **Reap Agentic Payments**. El cargo siempre lo aprueba el pagador en la página hospedada de Reap, así que el agente nunca toca datos de tarjeta.

## Casos de uso que cubre la base

| Tema del hackatón | Cómo se usa |
|---|---|
| Vida diaria / remesas en especie | La familia pide algo y el agente lo compra y lo envía a su dirección con un tope por contacto |
| Gasto empresarial | El empleado solicita, el agente cotiza contra su presupuesto y el manager aprueba en Reap |
| Comercio en chats | El mismo flujo de solicitud → cotización → aprobación, expuesto desde un chat |

## Estructura

```
app/        React Native 0.82 (TypeScript): chat con Gemini, contactos, métodos de pago, solicitudes
backend/    Express 5: proxy seguro hacia Reap (la API key vive solo aquí)
supabase/   Migraciones SQL: profiles, contacts (dirección + tope), purchase_requests
```

## Flujo

```
Chat (Gemini function calling)
  └─ create_purchase_request ─► Supabase purchase_requests (pending)
       └─ POST /api/agentic/products/search ─► Reap: opciones
            └─ usuario elige ─► POST /api/agentic/quotes ─► Reap: total con envío (quoted)
                 └─ confirma ─► POST /api/agentic/checkouts
                      · el backend vuelve a leer la cotización y rechaza si excede el tope
                      └─ página de aprobación de Reap ─► /agentic/return ─► transfertronix://agentic/return
                           └─ GET checkout ─► completed + orderId
```

## Configuración

### Backend

```bash
cd backend
cp .env.example .env   # REAP_API_KEY llega por Telegram al líder del equipo
npm install
npm run dev
```

- Reap exige un `returnUrl` HTTPS. Para pruebas en el teléfono, expón el backend con un túnel (por ejemplo `ngrok http 3000`) o despliégalo en Vercel, y pon esa URL en `PUBLIC_BASE_URL`.
- En sandbox, `REAP_SIMULATE_CHECKOUT=true` manda `X-Simulate-Checkout: COMPLETED` para demos sin aprobación manual.

### Supabase

Corre `supabase/migrations/*.sql` en orden, en un proyecto nuevo.

### App

```bash
cd app
cp config.example.ts config.ts   # Supabase, Gemini y la URL del backend
npm install
cd ios && bundle exec pod install && cd ..
npm run ios
```

## Reglas del hackatón que respeta

- Solo sandbox y solo comercios de la lista soportada (`/merchants` en el bot de Telegram).
- No hay scraping de checkout ni datos de tarjeta en el LLM: la tarjeta se registra con un enrollment en la página de Reap.
- Viajes, apuestas y contenido para adultos están fuera de alcance.

## Referencias

- [Reap Agentic Payments](https://docs.reap.global/agentic-payments/overview)
- [Brief del hackatón](https://aibuilders.mx/reap#brief)
