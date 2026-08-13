# 🏭 Toys Factory ERP (Backend API)

🚀 **Live API Base URL:** [https://api.toysfactoryerp.com](https://api.toysfactoryerp.com) *(Update with actual live URL)*  
💻 **GitHub Repository:** [https://github.com/himel2535/toys_factory_erp_backend](https://github.com/himel2535/toys_factory_erp_backend)

A robust, secure, and highly optimized RESTful API backend powering the Toys Factory ERP system.

---

## 🛠️ Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (with Mongoose ODM)
- **Language:** TypeScript
- **Authentication:** JWT (JSON Web Tokens) via HTTP-Only Cookies
- **Validation:** Zod (for type-safe schema validation)

---

## ⚡ Performance & Security Optimizations
This API is engineered to handle enterprise-level data processing with extreme efficiency:
- **Compound Database Indexes:** Optimized database queries with 128+ custom compound and unique indexes in MongoDB for lightning-fast lookups and sorting.
- **Stateless Authentication:** Uses JWT inside secure HTTP-only cookies, effectively mitigating XSS attacks and removing the need for heavy server-side session lookups on every request.
- **Pagination & Limiting:** Prevents data overload and reduces bandwidth by strictly serving chunked, paginated responses (e.g., 25/200 items per page) instead of massive arrays.
- **Lean Mongoose Queries:** Strategically utilizes Mongoose `.lean()` for read-only operations to bypass heavy document instantiation overhead, improving read response times.
- **Connection Pooling:** Reuses MongoDB connections efficiently to support high concurrency without dropping requests.
- **Strict CORS Policies:** Ensures API endpoints are only accessible from authorized frontend origins.

---

## 📦 Core Architecture & Modules

### 🔐 1. Authentication & Security
- Secure login, registration, and logout flows.
- Cookie-based session management.
- Middleware-driven Role-Based Access Control (RBAC) ensuring endpoints are protected based on user permissions.

### 📡 2. RESTful API Design
- Clean, predictable, and standard versioned API routes (`/api/v1/...`).
- Standardized JSON responses for successes and unified error handling middleware for failures.

### 📊 3. Advanced Data Aggregation
- Heavy utilization of complex MongoDB Aggregation pipelines (`$lookup`, `$group`, `$unwind`) for real-time calculation of Dashboard analytics, Accounting Ledgers, and Inventory Valuation Reports.

### 🏭 4. Core Business Logic Routes
- **Inventory & Manufacturing:** Endpoints for BOM (Recipes), stock adjustments, warehouse tracking, and production workflows.
- **Sales & CRM:** Manage leads, customers, POS transactions, and invoices.
- **Purchases & Payables:** Supplier management, purchase orders, and goods receipts.
- **Accounting:** Double-entry ledger systems, cashbox monitoring, and financial reports.
- **HR & Payroll:** Employee records, attendance logs, and automated salary sheet generation.

### 📝 5. System Audit Logs
- Centralized logging system to track all critical document mutations (Create, Update, Delete) for accountability and compliance.

---

## 💻 Running Locally

1. Clone the repository
2. Install dependencies: `npm install`
3. Setup environment variables by copying `.env.example` to `.env` (Provide your MongoDB URI)
4. Build the TypeScript code: `npm run build`
5. Start the development server: `npm run dev`
