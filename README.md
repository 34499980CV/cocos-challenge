# Trading API

API REST en Node.js + TypeScript para consultar portfolio, buscar activos y enviar órdenes al mercado.

## Requisitos

- Node.js 18+
- PostgreSQL (Neon)

## Instalación

```bash
npm install
cp .env.example .env
# Editar .env con la DATABASE_URL
```

## Ejecución

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

La API corre en `http://localhost:3000`.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/portfolio/:userId` | Portfolio del usuario |
| GET | `/api/instruments/search?q=` | Buscar activos por ticker o nombre |
| GET | `/api/orders/user/:userId` | Listar órdenes del usuario |
| POST | `/api/orders` | Crear orden (MARKET o LIMIT) |
| PATCH | `/api/orders/:id/cancel` | Cancelar orden NEW |

## Crear orden

```json
{
  "userId": 1,
  "instrumentId": 2,
  "side": "BUY",
  "type": "MARKET",
  "amount": 50000
}
```

- **quantity**: cantidad exacta de acciones (sin fracciones)
- **amount**: monto en pesos (solo BUY; calcula acciones con `floor(amount / price)`)
- **price**: obligatorio en órdenes LIMIT

## Estados de orden

| Estado | Descripción |
|--------|-------------|
| NEW | Orden LIMIT enviada, pendiente |
| FILLED | Orden ejecutada (MARKET se ejecuta al instante) |
| REJECTED | Fondos o acciones insuficientes |
| CANCELLED | Cancelada por el usuario (solo NEW) |

## Colecciones de prueba

- `requests.http` — REST Client (VS Code)
- `postman/Trading-API.postman_collection.json` — Postman

## Lógica de negocio

- Cash (ARS) modelado como instrumento `MONEDA`
- Posiciones y cash calculados desde órdenes `FILLED` usando columna `size`
- Transferencias de cash: `CASH_IN` / `CASH_OUT`
- Precios de mercado desde `marketdata.close` (último día)
- Rendimiento diario: `(close - previousclose) / previousclose`

## Supuestos y decisiones de diseño

- Las ordenes de compra/venta (`BUY`/`SELL`) y las transferencias (`CASH_IN`/`CASH_OUT`) comparten la tabla `orders`.
- En transferencias, el `side` representa la direccion del movimiento y el `type` se guarda como `MARKET`.
- En `BUY` por `amount`, la cantidad se calcula con `floor(amount / price)`; no se admiten fracciones de acciones.
- En `LIMIT`, `price` es obligatorio; en `MARKET`, el precio de ejecucion usa el ultimo `close` de `marketdata`.
- Las ordenes `MARKET` se persisten como `FILLED`; las `LIMIT` como `NEW`.
- Solo se pueden cancelar ordenes en estado `NEW`.
- `availableCash` se calcula desde ordenes `FILLED`, incluyendo transferencias de cash y efecto monetario de `BUY`/`SELL`.
- `totalAccountValue` se calcula como `availableCash + valor de mercado de posiciones abiertas`.
- Se incluye test funcional HTTP del endpoint de ordenes en `src/test/functional/orders.create.functional.test.ts`.
