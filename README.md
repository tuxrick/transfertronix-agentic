# Transfertronix · Agentic Hackathon

Agente que compra para ti, tu familia o tu equipo **dentro de un tope de gasto**. Alguien pide algo, el agente busca en comercios compatibles y cotiza con envío, y quien paga confirma el cargo. Cada solicitud queda registrada, de la petición a la orden.

Soporta los dos módulos del hackatón, intercambiables con una variable de entorno:

| Proveedor | Cómo paga | Aprobación |
|---|---|---|
| **Reap Agentic Payments** (`PAYMENT_PROVIDER=reap`) | Tarjeta guardada una vez (enrollment) | El usuario aprueba cada cargo en la página hospedada de Reap |
| **Kwal de Payward** (`PAYMENT_PROVIDER=kwal`) | Tarjeta del agente respaldada por USDC en una bóveda en Ink Sepolia | El usuario confirma en la app; la bóveda paga |

## Casos de uso

| Tema | Cómo se usa |
|---|---|
| Gasto empresarial | Un empleado solicita (teclado, hub USB-C, monitor, artículos de oficina), el agente cotiza contra su tope y el manager confirma |
| Vida diaria | Regalos y reabastecimiento para la familia con tope por contacto (café, libros, hogar) |
| Stablecoins y economía de agentes | Con Kwal, la tesorería del equipo vive en una bóveda USDC y el agente gasta contra ella |

## Estructura

```
app/        React Native 0.82 (TypeScript): chat con Gemini, contactos, métodos de pago, solicitudes
backend/    Express 5: contrato de comercio normalizado sobre Reap o Kwal (las llaves viven solo aquí)
  src/providers/   adaptadores reap.js y kwal.js
  src/catalog/     lista de comercios compatibles (src/data/merchants.json)
supabase/   Migraciones SQL: profiles, contacts (dirección + tope), purchase_requests
```

## Flujo

```
Chat (Gemini function calling)
  └─ create_purchase_request ─► Supabase purchase_requests (pending)
       └─ POST /api/commerce/products/search
            · búsqueda del proveedor; si no hay resultados (Reap), productos de prueba
              de comercios compatibles que envían al país del contacto
            └─ usuario elige ─► POST /api/commerce/quotes ─► total con envío (quoted)
                 └─ confirma ─► POST /api/commerce/checkouts
                      · el backend relee la cotización y rechaza si excede el tope
                        o si el tope está en otra moneda
                      ├─ Reap: página de aprobación ─► /agentic/return ─► deep link a la app
                      └─ Kwal: la bóveda paga; la app consulta el pago hasta completarse
                           └─ completed + orderId
```

## Reglas del hackatón que respeta

- **Solo sandbox:** el checkout es simulado y no se mueve dinero real.
- **Solo comercios compatibles:** el backend rechaza cualquier carrito fuera de `backend/src/data/merchants.json`, y el agente solo ofrece categorías que envían al país del contacto.
- **Sin atajos:** no hay scraping de checkout ni datos de tarjeta en el LLM. La tarjeta se captura en la página de Reap o vive en Kwal.
- **Fuera de alcance:** viajes y categorías restringidas.

> Ojo con el envío: de los 152 comercios, solo 3 son de México (acteck.com, balamrush.com y blendstation.com.mx). Hay 74 que envían a MX, sobre todo electrónica, café, papelería y moda. Nada de abarrotes ni artículos de bebé envía a MX.

## Configuración

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

- Las credenciales del sandbox llegan por privado al líder del equipo. **Nunca pegues llaves ni datos de tarjeta en el grupo ni en el repo.**
- Reap exige un `returnUrl` HTTPS. Para pruebas en el teléfono, expón el backend con un túnel (por ejemplo `ngrok http 3000`) o despliégalo en Vercel, y pon esa URL en `PUBLIC_BASE_URL`.

### Reap: registrar la tarjeta del sandbox

1. En la app ve a **Métodos de pago → Agregar tarjeta**. Se abre la página de Reap para capturarla.
2. Usa la tarjeta asignada al equipo: en el número, cambia cada `x` por `4`. Si el CVV tiene menos de 3 dígitos, agrega ceros al inicio (`7` → `007`, `47` → `047`).
3. Cuando pida OTP, usa `456789`.
4. Regresa a la app; la tarjeta debe aparecer como **Activa**.

`REAP_SIMULATE_CHECKOUT=true` simula la aprobación del checkout (solo sandbox) para demos rápidas.

### Kwal: bóveda USDC en Ink Sepolia

La bóveda se configura una sola vez con el [skill de Kwal](https://github.com/payward/kwal-skill) en Claude Code:

```bash
claude plugin marketplace add payward/kwal-skill
claude plugin install agent-payment@kwal-agent-payment
```

Luego invócalo con `/agent-payment:agent-payment` y sigue los pasos:

1. **Registrar participante:** crea una sesión que dura 7 días y no se renueva. No registres dos veces.
2. **Configurar bóveda y tarjeta** con la dirección de una wallet EVM que controles. Cada participante necesita su propia dirección.
3. **Fondear:** ETH de prueba para gas y USDC de prueba, transferidos a la bóveda. El skill imprime la dirección del token y los faucets.
   - Red: Ink Sepolia, chain ID `763373`, [explorer](https://explorer-sepolia.inkonchain.com), [faucet ETH (thirdweb)](https://thirdweb.com/ink-sepolia).
4. En `backend/.env` pon `PAYMENT_PROVIDER=kwal` y `KWAL_CREDENTIALS_FILE` con la ruta absoluta al `credentials.json` del skill (normalmente `~/.config/pws/agent-payment/credentials.json`). Debe quedar fuera del repo.

Notas del sandbox de Kwal: solo cotiza en USD (1 USD = 1 USDC), las cotizaciones locales cuestan 1 USDC por artículo y nada se envía.

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

## Referencias

- [Reap Agentic Payments](https://docs.reap.global/agentic-payments/overview)
- [Skill de agente Kwal](https://github.com/payward/kwal-skill)
- [Ink Sepolia](https://thirdweb.com/ink-sepolia)
