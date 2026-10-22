# FoodFax — Setup Guide 🚀

> **Phase 1 — 100% Local on Mac Mini M2**  
> Self-hosted Supabase Docker stack. No remote tunnel or cloud dependency required.

---

## Part 1 — Local Development Setup (Mac Mini M2)

### Prerequisites

| Tool | Version | Install Command |
|---|---|---|
| Node.js | v20+ | `brew install node` |
| npm | v10+ | bundled with Node |
| Docker Desktop | Latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Supabase CLI | Latest | `brew install supabase/tap/supabase` |
| Git | Any | `brew install git` |

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/mohitsingh/foodfax.git
cd foodfax
```

---

### Step 2 — Install Node Dependencies

```bash
npm install
```

---

### Step 3 — Verify Local Supabase Docker is Running

The local Supabase Docker stack should already be running on the Mac Mini.  
Verify it is healthy:

```bash
# Check running containers
docker ps | grep supabase

# Or use Supabase CLI
supabase status
```

Expected output — all services should be `UP`:

```
         API URL: http://127.0.0.1:8000
     GraphQL URL: http://127.0.0.1:8000/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:5432/postgres
      Studio URL: http://127.0.0.1:3001
    Inbucket URL: http://127.0.0.1:9100
      JWT secret: <your-jwt-secret>
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> If Supabase is NOT running, start it:
> ```bash
> supabase start
> ```

---

### Step 4 — Create `.env` File (Already done — verify it)

The `.env` file at the root should point to local Supabase:

```bash
cat .env
```

Expected content:

```env
VITE_SUPABASE_URL="http://127.0.0.1:8000"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNTE3Njk3LCJleHAiOjE5NTAxOTc2OTd9.m-Kkdq0uf2fr0365ulaLFOW-kWdXO35kaZnJSV_oCwo"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_XETlv-5aDAAmKuBuU1YQTZ_HCGGL2mc"
```

> ⚠️ The old cloud credentials are backed up in `.env.cloud-backup-2026-10-21`. Keep that file safe and **never commit it to Git**.

---

### Step 5 — Verify Database Tables are Live

Open Supabase Studio at **http://127.0.0.1:3001** and confirm these 14 tables exist in the `public` schema:

- `users`, `customers`, `shops`, `categories`, `menu_items`
- `orders`, `order_items`, `payments`, `order_status_history`
- `shop_token_counters`, `favorite_shops`, `notifications`
- `kyc_documents`, `ai_action_logs`

Or via `psql`:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" \
  -c "\dt public.*"
```

---

### Step 6 — Verify Seed Data

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" \
  -c "SELECT id, name, is_active, is_open FROM public.shops;"
```

Expected: At least one row — **Mumbai Masala Chaat Stall** (`shop_mumbai_chaat_01`).

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" \
  -c "SELECT id, name, price FROM public.menu_items WHERE shop_id = 'shop_mumbai_chaat_01';"
```

Expected: `Sev Puri`, `Pani Puri`, `Masala Chai`.

---

### Step 7 — Start the Dev Server

```bash
npm run dev
```

App will start at: **http://localhost:3000**

On local network (same Wi-Fi as Mac Mini): **http://<Mac-Mini-IP>:3000**

Find your Mac Mini IP:
```bash
ipconfig getifaddr en0
# or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

---

### Step 8 — Verify Supabase Connection in Browser

1. Open **http://localhost:3000** in browser
2. Open DevTools → Console
3. Look for:
   ```
   [Supabase] ✅ Configured →  http://127.0.0.1:8000
   [Supabase] Successfully connected to http://127.0.0.1:8000
   ```

If you see `Running in demo / mock data mode`, check your `.env` file.

---

### Step 9 — Feature Verification Checklist

| Feature | How to Test | Expected Result |
|---|---|---|
| **Shop Discovery** | Open app, allow location or pick city | Shops load from DB |
| **Shop Detail** | Tap any shop | Menu items appear |
| **Cart** | Add items | Cart updates (in-memory) |
| **Order Placement** | Checkout → Place Order | Order appears in `orders` table, token generated |
| **Token Counter** | Place order | `shop_token_counters` row created/incremented |
| **Order Tracking** | After placing order | Status shows PENDING |
| **Registration** | Register new customer | Row created in `customers` table |
| **Login** | Login with phone+password | Session saved in localStorage |
| **Saved Shops** | Tap heart icon on shop | Row in `favorite_shops` table |
| **Notifications** | Place/cancel order | Row in `notifications` table |

---

### TypeScript Check & Build

```bash
# TypeScript typecheck (0 errors expected)
npm run lint

# Production build
npm run build

# Preview production build locally
npm run preview
```

---

### Useful Local Commands

```bash
# Supabase Studio (Admin UI)
open http://127.0.0.1:3001

# Check Supabase logs
supabase logs

# Stop Supabase
supabase stop

# Restart Supabase
supabase stop && supabase start

# Direct DB access
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
```

---

## Part 2 — Vercel Deployment Setup

> **When to use:** After Phase 1 local testing is complete and you're ready to go live with a public URL.

### Prerequisites

- Vercel account at [vercel.com](https://vercel.com)
- Vercel CLI: `npm i -g vercel`
- A **remote** Supabase project (either cloud or self-hosted with a public tunnel)

---

### Step 1 — Link Project to Vercel

```bash
cd foodfax
vercel login
vercel link
```

Follow the prompts:
- Select your team/org
- Link to existing project or create new

---

### Step 2 — Set Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these for **Production**, **Preview**, and **Development** environments:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your production Supabase URL (e.g. `https://xyz.supabase.co` or your tunnel URL) |
| `VITE_SUPABASE_ANON_KEY` | Production anon/publishable key |
| `VITE_GOOGLE_MAPS_API_KEY` | Your Google Maps API key |
| `VITE_GOOGLE_ROUTES_API_KEY` | Your Google Routes API key |
| `UPIQRPAY_API_KEY` | UPIQRPay gateway key |
| `VITE_UPIQRPAY_API_KEY` | Same as above (for client-side) |

> ⚠️ **NEVER** add `SUPABASE_SERVICE_ROLE_KEY` as a `VITE_` variable — it would be exposed to the browser. Only set it without the `VITE_` prefix for server-side Vercel Functions (API routes).

Or set via CLI:

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
# ... repeat for each variable
```

---

### Step 3 — Vercel Project Configuration

The `vercel.json` is already configured in the repo with:
- Asset caching headers (`Cache-Control: immutable`)
- Security headers (`X-Frame-Options: DENY`, etc.)
- SPA rewrite rule (all routes → `index.html`)
- API payment route rewrites (`/api/payment/status/:id`)

No changes needed to `vercel.json` for standard deployment.

---

### Step 4 — Deploy to Vercel

```bash
# Preview deployment (test before going live)
vercel

# Production deployment
vercel --prod
```

Or simply push to `main` branch if auto-deploy is configured:

```bash
git add .
git commit -m "chore: local supabase integration"
git push origin main
```

Vercel will automatically build and deploy.

---

### Step 5 — Verify Vercel Deployment

1. Open your Vercel deployment URL
2. DevTools → Console → Look for `[Supabase] ✅ Configured → https://your-prod-supabase-url`
3. Test registration, shop browse, order placement

---

### Step 6 — Custom Domain (Optional)

In Vercel Dashboard → Settings → Domains:

```
Add: foodfax.in
Add: www.foodfax.in
```

Vercel will provide DNS records to add in your domain registrar.

---

### Production Checklist Before Going Live

- [ ] RLS policies scoped (replace `USING (true)` with role-based policies)
- [ ] Service Role Key NOT exposed in any `VITE_` env variable
- [ ] Cloud Supabase URL and anon key set in Vercel env vars
- [ ] Realtime tables published (`orders`, `notifications`, `payments`, etc.)
- [ ] Storage buckets (`avatars`, `shop-images`) configured on production Supabase
- [ ] UPIQRPay webhook URL points to production domain (`https://foodfax.in/api/payment/webhook`)
- [ ] Google Maps API key restricted to production domain
- [ ] `is_demo = false` filter active in production queries

---

## Environment Summary

| Variable | Local Dev | Vercel Production |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:8000` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Local anon key | Cloud anon key |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Local publishable key | Cloud publishable key |
| `VITE_GOOGLE_MAPS_API_KEY` | Dev key | Production key (domain-restricted) |
| `UPIQRPAY_API_KEY` | Test key | Live BharatPe key |

---

## Troubleshooting

### App shows mock/demo data instead of real shops

**Check:** Open DevTools console. If you see `Running in demo / mock data mode`:
1. Verify `.env` file exists at project root
2. Check `VITE_SUPABASE_URL` starts with `http://127.0.0.1:8000`
3. Restart dev server: `npm run dev`

### `net::ERR_CONNECTION_REFUSED` on API calls

Supabase Docker is not running. Fix:
```bash
supabase start
```

### Realtime not working (orders not updating live)

Check WebSocket connection in DevTools → Network → WS tab.
If no WS connection, verify Supabase Realtime service:
```bash
docker ps | grep supabase_realtime
```

### Port 3000 already in use

```bash
# Kill whatever is using port 3000
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Build warning: chunk size > 500kB

This is a warning, not an error. The app builds and runs fine.  
For future optimization, consider dynamic imports for heavy views (business panel, charts).

