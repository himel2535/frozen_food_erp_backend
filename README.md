# Toys Factory ERP — Backend

Standalone **Express.js + Mongoose** API for the Toys Factory ERP frontend.

> **Important:** This folder lives **outside** `toys_factory_erp/`.  
> The frontend still uses **Firebase RTDB + Zustand** today. This backend is ready for when you choose to connect it — zero conflict with the current app.

## Stack

- Node.js 20+
- Express 5
- Mongoose 8 (MongoDB)
- TypeScript

## Quick start

### 1. Install MongoDB locally (if needed)

- Windows: [MongoDB Community Server](https://www.mongodb.com/try/download/community)
- Or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier and set `MONGODB_URI`

### 2. Install dependencies

```bash
cd toys_factory_erp_backend
npm install
```

### 3. Environment

```bash
copy .env.example .env
```

Edit `.env` if your MongoDB URL or frontend port differs.

### 4. Run (development)

```bash
npm run dev
```

Server: `http://localhost:5000`

### 5. Verify

```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/v1/customers
```

## API overview

Base URL: `http://localhost:5000/api/v1`

| Resource | Endpoints |
|----------|-----------|
| Customers | `GET/POST /customers`, `GET/PUT/PATCH/DELETE /customers/:id` |
| Products | `GET/POST /products`, … |
| Suppliers | `GET/POST /suppliers`, … |
| Employees | `GET/POST /employees`, … |
| Sales orders | `GET/POST /sales-orders`, … |
| Invoices | `GET/POST /invoices`, … |

### Query params (lists)

- `page` — default 1
- `limit` — default 20, max 100
- `search` or `q` — text search
- `status` — filter by status
- `tenantId` — default `default` (multi-tenant ready)

### Bulk seed (optional)

```http
POST /api/v1/customers/seed
Content-Type: application/json

[{ "name": "Test Co", "company": "Test Co Ltd", "status": "active" }]
```

## Response shape

```json
{
  "success": true,
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 1 }
}
```

## Connect to frontend (later)

When you are ready:

1. Add `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1` to `web/.env.local`
2. Create a thin client in `web/lib/api/` that calls these endpoints
3. Gradually move modules from Firebase `appState` to API — module by module

Firebase auth/admin can stay until you migrate auth.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production build |
| `npm run lint` | Typecheck |

## Project structure

```
toys_factory_erp_backend/
├── src/
│   ├── server.ts          # Entry point
│   ├── app.ts             # Express app
│   ├── config/            # env + MongoDB
│   ├── models/            # Mongoose schemas
│   ├── controllers/       # CRUD handlers
│   ├── routes/            # Route definitions
│   ├── middleware/        # Errors, optional API key
│   └── utils/
├── .env.example
└── package.json
```

## Security (optional)

Set `API_KEY` in `.env` and send header `x-api-key: your-key` on requests. Leave empty in dev to skip auth.
