# FoodFax — Agent Rules & System Specifications

> This project follows strict specifications for architecture, database, payments, and development setup.
> For the complete operational guide, refer to [`docs/agent/agent.md`](docs/agent/agent.md).

## Specifications Index

- **AI Agent Guidelines**: [`docs/agent/agent.md`](docs/agent/agent.md)
- **Database Architecture & Schema**: [`docs/database/database.md`](docs/database/database.md)
- **Supabase Credentials**: [`docs/database/readme-supa.md`](docs/database/readme-supa.md)
- **Payment Gateway Architecture**: [`docs/payment/payment.md`](docs/payment/payment.md)
- **Local Setup Guide**: [`docs/setup/setup.md`](docs/setup/setup.md)

## Strict Agent Constraints
1. **Zero Fragmented Storage**: Never use localStorage or mock databases for persistent entities (shop, menu, orders). Supabase PostgreSQL is the single source of truth.
2. **Central Merchant Payments**: Payments route centrally to `bharatpe2e0p0d8x5a59798@unitype`.
3. **Zero Phantom Debits**: Orders must be saved in `PENDING` status before payment gateway checkout.
4. **Lean Queries**: Always use column selection and pagination (`limit`) to minimize bandwidth.

