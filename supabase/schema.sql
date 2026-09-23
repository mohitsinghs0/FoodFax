-- ============================================================================
-- FoodFax (FoodFlow) — Complete Supabase PostgreSQL Schema
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE
-- Extended user profile mirroring auth.users
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  phone TEXT,
  email TEXT,
  full_name TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'owner', 'admin')),
  shop_id TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  area TEXT,
  city TEXT,
  profile_completed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. SHOPS TABLE
-- Food stalls, thelas, tapris, canteens, counters
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shops (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT,
  stall_type TEXT DEFAULT 'Thela / Food Stall',
  tagline TEXT,
  description TEXT,
  image TEXT,
  banner_image TEXT,
  phone TEXT,
  contact_phone TEXT,
  address TEXT,
  area TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  upi_id TEXT,
  opening_time TEXT DEFAULT '10:00 AM',
  closing_time TEXT DEFAULT '10:00 PM',
  opening_hours TEXT,
  is_open BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  is_pure_veg BOOLEAN DEFAULT FALSE,
  rating NUMERIC(3,2) DEFAULT 4.5,
  total_reviews INTEGER DEFAULT 0,
  preparation_time_minutes TEXT DEFAULT '5-10',
  featured_item TEXT,
  is_rush_hour BOOLEAN DEFAULT FALSE,
  table_service_available BOOLEAN DEFAULT FALSE,
  categories TEXT[] DEFAULT ARRAY['fast-food', 'snacks']::TEXT[],
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon_name TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. MENU ITEMS TABLE
-- Individual items served by each stall
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image TEXT,
  is_veg BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  is_bestseller BOOLEAN DEFAULT FALSE,
  preparation_time_min INTEGER DEFAULT 5,
  preparation_minutes TEXT DEFAULT '5-10',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  customization_options JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. ORDERS TABLE
-- Counter orders with high-rush token numbers and status tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  shop_image TEXT,
  shop_location TEXT,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  token_number TEXT NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'TAKEAWAY' CHECK (order_type IN ('TAKEAWAY', 'DINE_IN')),
  table_number TEXT,
  payment_method TEXT NOT NULL DEFAULT 'CASH_AT_COUNTER' CHECK (payment_method IN ('CASH_AT_COUNTER', 'PAY_ONLINE')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'COLLECT_ON_DELIVERY', 'REFUNDED', 'FAILED')),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (order_status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_preparation_minutes TEXT DEFAULT '5-10',
  instructions TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  reviewed_at TIMESTAMPTZ,
  feedback_tags TEXT[] DEFAULT '{}'::TEXT[],
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. ORDER ITEMS TABLE (Snapshot items for historical consistency)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id TEXT,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_veg BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_mode TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  amount NUMERIC(10,2) NOT NULL,
  transaction_id TEXT,
  provider TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. ORDER STATUS HISTORY (Immutable Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. FAVORITE SHOPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.favorite_shops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

-- ============================================================================
-- 10. SHOP TOKEN COUNTER TABLE (Daily Sequential Token Numbers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shop_token_counters (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  token_date DATE NOT NULL,
  last_token INTEGER NOT NULL DEFAULT 100,
  UNIQUE(shop_id, token_date)
);

-- ============================================================================
-- 11. NOTIFICATIONS TABLE
-- Real-time alerts for stall owners and customers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  shop_id TEXT REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id TEXT,
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ORDER_NEW', 'ORDER_READY', 'ORDER_CANCELLED', 'PAYMENT', 'ALERT', 'INFO')),
  token_number TEXT,
  amount NUMERIC(10,2),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 12. AI ACTION LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  user_id TEXT,
  action_type TEXT NOT NULL,
  command_text TEXT,
  tool_name TEXT,
  action_status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ATOMIC FUNCTION: Generate Daily Shop Token (#101, #102...)
-- Concurrency-safe counter with row-level locking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_daily_shop_token(p_shop_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_counter_id TEXT := p_shop_id || '_' || TO_CHAR(v_today, 'YYYY-MM-DD');
  v_next_token INTEGER;
BEGIN
  INSERT INTO public.shop_token_counters (id, shop_id, token_date, last_token)
  VALUES (v_counter_id, p_shop_id, v_today, 101)
  ON CONFLICT (id)
  DO UPDATE SET last_token = public.shop_token_counters.last_token + 1
  RETURNING last_token INTO v_next_token;

  RETURN v_next_token;
END;
$$;

-- ============================================================================
-- REALTIME ENABLEMENT
-- Ensure the orders and notifications tables publish changes to Realtime channels
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_token_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for the development phase (Supports anon & authenticated)
-- Can be restricted later for strict multi-tenant roles
CREATE POLICY "Public full access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on shops" ON public.shops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on order_status_history" ON public.order_status_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on favorite_shops" ON public.favorite_shops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on shop_token_counters" ON public.shop_token_counters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on ai_action_logs" ON public.ai_action_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- STORAGE BUCKET: avatars
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload avatars" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can update avatars" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars');
