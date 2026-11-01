# FoodFax — AI Agent Guidelines & Engineering Specifications

> **Official Operating Guide & Master Rules for AI Agents and Developers working on the FoodFax Ecosystem**  
> **Last Updated:** October 2026

---

## 1. Core Engineering Principles

Every AI Agent modifying or extending FoodFax must strictly adhere to the following architectural rules:

### A. Database & Storage Rules (From `docs/database/database.md`)
1. **Zero Fragmented Storage:** Shop owner, restaurant profile, menu catalog, KYC documents, and live orders must NEVER be stored in an isolated external database, mock server, or browser localStorage. Supabase PostgreSQL is the single source of truth. LocalStorage / IndexedDB are strictly reserved for offline resilience and transient UI cache.
2. **Direct Schema Grounding:** All applications use standard `public`, `auth`, and `storage` schemas. Never introduce divergent tables.
3. **Admin Panel Compatibility:** Shop Owner, Customer, and Admin applications share identical database schemas and foreign keys. Data created in one app must reflect without transformations in another.
4. **Instant Synchronization:** State changes must immediately synchronize via Supabase Realtime listeners and application state managers.
5. **Anti-Egress Policy:** Always project minimal columns (`select('id, name, ...')`) and enforce pagination (`limit(50)`) to conserve bandwidth and avoid heavy queries.

### B. Payment & Financial Integrity (From `docs/payment/payment.md`)
1. **Central Platform Merchant Model:** All online customer payments flow centrally through platform merchant **Mohit Santosh Singh** (`bharatpe2e0p0d8x5a59798@unitype`) via BharatPe Business & UPIQRPay.
2. **Zero Phantom Debits:** Orders MUST be locked in PostgreSQL as `PENDING` with a sequential token BEFORE opening the payment gateway. If a customer's payment succeeds, the order can never vanish.
3. **Strict Price Integrity:** Frontend must charge exact cart totals (no dynamic paise manipulation like ₹1.03, ₹1.04). Amounts must match between frontend, backend, and gateway.

### C. Technology Stack & Frameworks
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Motion (Framer Motion), Lucide Icons, Recharts.
- **Backend / APIs:** Vercel Serverless Functions (`/api`), Node.js Express (`/server`).
- **Database / Auth:** PostgreSQL 17 on Supabase (Self-hosted Docker on Mac Mini M2 / Cloud Supabase).
- **Payment Infrastructure:** BharatPe Business + UPIQRPay API.

---

## 2. Specifications Directory Index

All detailed specifications and technical manuals are organized in the `docs/` directory:

| Specification | Path | Description |
|---|---|---|
| **AI Agent Guide** | `docs/agent/agent.md` | Master guidelines and operational rules for AI coding agents |
| **Database Architecture** | `docs/database/database.md` | Single source of truth for PostgreSQL schema, tables, and anti-egress rules |
| **Supabase Configuration** | `docs/database/readme-supa.md` | Supabase project credentials, endpoints, and API keys |
| **Payment Architecture** | `docs/payment/payment.md` | Complete UPI gateway manual, merchant credentials, webhook specifications |
| **Setup Guide** | `docs/setup/setup.md` | Local development stack on Mac Mini M2, Docker, and Supabase CLI |

---

## 3. Workflow for AI Agents

1. **Understand Before Modifying:** Check relevant specifications in `docs/` before implementing features touching database schemas, payment flows, or authentication.
2. **Preserve Integrity:** Never introduce mock state where database tables exist.
3. **Verify Changes:** Run unit tests (`npm test`) and type check (`npm run lint`) after modifications.

