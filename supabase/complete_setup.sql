-- ============================================================================
-- FOODFAX — COMPLETE ALL-IN-ONE DATABASE SETUP SCRIPT
-- Copy this entire file and run it once in Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- 2. USERS TABLE
-- Extended user profile mirroring auth.users
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  phone TEXT,
  email TEXT,
  full_name TEXT,
  password TEXT,
  password_hash TEXT,
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

-- Ensure password and helper columns exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ============================================================================
-- 3. CUSTOMERS TABLE
-- Dedicated customer table storing registered customer credentials & profile
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  password TEXT NOT NULL,
  password_hash TEXT,
  email TEXT,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  area TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  profile_completed BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. SHOPS TABLE (With PostGIS Location & UPIQRPay multi-merchant columns)
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
  location GEOGRAPHY(Point, 4326),
  is_mobile_stall BOOLEAN DEFAULT false,
  location_accuracy_meters INTEGER,
  last_location_updated_at TIMESTAMPTZ,
  upi_id TEXT,
  upiqrpay_api_key TEXT,
  upiqrpay_webhook_secret TEXT,
  is_online_payment_enabled BOOLEAN DEFAULT TRUE,
  merchant_provider TEXT DEFAULT 'bharatpe',
  accepts_delivery BOOLEAN DEFAULT false,
  delivery_radius_km NUMERIC DEFAULT 3.0,
  delivery_fee_type TEXT DEFAULT 'free',
  delivery_fee_amount NUMERIC DEFAULT 0,
  opening_time TEXT DEFAULT '10:00 AM',
  closing_time TEXT DEFAULT '10:00 PM',
  opening_hours TEXT,
  is_open BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  is_suspended BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  kyc_status TEXT DEFAULT 'approved',
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

-- Comments for developer clarity
COMMENT ON COLUMN public.shops.upiqrpay_api_key IS 'Shop-specific UPIQRPay API Key for direct merchant settlement';
COMMENT ON COLUMN public.shops.upiqrpay_webhook_secret IS 'Shop-specific Webhook Secret for HMAC-SHA256 signature verification';
COMMENT ON COLUMN public.shops.is_online_payment_enabled IS 'Controls whether customer can pay online via UPI for this shop';

-- Spatial & performance indexes on shops
CREATE INDEX IF NOT EXISTS idx_shops_location_gist ON public.shops USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_active_open ON public.shops (is_active, is_open);

-- ============================================================================
-- 5. CATEGORIES TABLE
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
-- 6. MENU ITEMS TABLE
-- Individual items served by each food stall
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

CREATE INDEX IF NOT EXISTS idx_menu_items_shop_id ON public.menu_items(shop_id);

-- ============================================================================
-- 7. ORDERS TABLE (Full Payment Status Lifecycle & Token Numbers)
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
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN (
    'PENDING', 
    'INITIATED', 
    'PROCESSING', 
    'PAID', 
    'FAILED', 
    'CANCELLED', 
    'EXPIRED', 
    'REFUNDED', 
    'COLLECT_ON_DELIVERY'
  )),
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

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ============================================================================
-- 8. ORDER ITEMS TABLE (Snapshot items for historical integrity)
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

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ============================================================================
-- 9. PAYMENTS TABLE (Audit Trail & UPIQRPay Parameters)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id TEXT REFERENCES public.shops(id) ON DELETE SET NULL,
  customer_id TEXT,
  payment_mode TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  transaction_id TEXT,
  provider TEXT,
  provider_payment_id TEXT,
  provider_order_id TEXT,
  merchant_ref TEXT,
  qr_code_data TEXT,
  upi_intent_url TEXT,
  utr_number TEXT,
  failure_reason TEXT,
  raw_payload JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON public.payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_utr_number ON public.payments(utr_number);

-- ============================================================================
-- 10. ORDER STATUS HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON public.order_status_history(order_id);

-- ============================================================================
-- 11. FAVORITE SHOPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.favorite_shops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

-- ============================================================================
-- 12. SHOP TOKEN COUNTERS TABLE (Atomic daily order token numbers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shop_token_counters (
  shop_id TEXT NOT NULL,
  date_key DATE NOT NULL DEFAULT CURRENT_DATE,
  last_token_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (shop_id, date_key)
);

-- ============================================================================
-- 13. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  recipient_role TEXT NOT NULL DEFAULT 'customer' CHECK (recipient_role IN ('customer', 'owner', 'admin')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'order_update',
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);

-- ============================================================================
-- 14. KYC DOCUMENTS & AI LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 15. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function: Atomic Daily Token Counter
CREATE OR REPLACE FUNCTION public.get_next_order_token(p_shop_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_token INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO public.shop_token_counters (shop_id, date_key, last_token_number, updated_at)
  VALUES (p_shop_id, v_today, 1, NOW())
  ON CONFLICT (shop_id, date_key)
  DO UPDATE SET
    last_token_number = public.shop_token_counters.last_token_number + 1,
    updated_at = NOW()
  RETURNING last_token_number INTO v_next_token;

  RETURN v_next_token;
END;
$$;

-- Function & Trigger: Automatic Sync between Shop Coordinates & PostGIS Location
CREATE OR REPLACE FUNCTION public.sync_shop_location_coords()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSIF NEW.location IS NOT NULL THEN
    NEW.longitude := ST_X(NEW.location::geometry);
    NEW.latitude := ST_Y(NEW.location::geometry);
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shop_location_coords ON public.shops;
CREATE TRIGGER trg_sync_shop_location_coords
BEFORE INSERT OR UPDATE OF latitude, longitude, location
ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.sync_shop_location_coords();

-- Function: Find Nearby Shops RPC (Using PostGIS)
CREATE OR REPLACE FUNCTION public.find_nearby_shops(
  customer_lat DOUBLE PRECISION,
  customer_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 15.0,
  service_type TEXT DEFAULT 'all'
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  stall_type TEXT,
  is_mobile_stall BOOLEAN,
  address TEXT,
  area TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rating NUMERIC,
  total_reviews INTEGER,
  preparation_time_minutes TEXT,
  is_open BOOLEAN,
  table_service_available BOOLEAN,
  accepts_delivery BOOLEAN,
  delivery_radius_km NUMERIC,
  delivery_fee_type TEXT,
  delivery_fee_amount NUMERIC,
  distance_meters DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  customer_point GEOGRAPHY;
BEGIN
  IF customer_lat IS NULL OR customer_lng IS NULL THEN
    RETURN;
  END IF;

  customer_point := ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    s.id::TEXT,
    s.name::TEXT,
    s.stall_type::TEXT,
    COALESCE(s.is_mobile_stall, false),
    s.address::TEXT,
    s.area::TEXT,
    s.city::TEXT,
    s.latitude::DOUBLE PRECISION,
    s.longitude::DOUBLE PRECISION,
    s.rating::NUMERIC,
    s.total_reviews::INTEGER,
    s.preparation_time_minutes::TEXT,
    s.is_open::BOOLEAN,
    s.table_service_available::BOOLEAN,
    COALESCE(s.accepts_delivery, false),
    s.delivery_radius_km::NUMERIC,
    s.delivery_fee_type::TEXT,
    s.delivery_fee_amount::NUMERIC,
    ST_Distance(s.location, customer_point)::DOUBLE PRECISION AS distance_meters,
    (ST_Distance(s.location, customer_point) / 1000.0)::DOUBLE PRECISION AS distance_km
  FROM public.shops s
  WHERE s.location IS NOT NULL
    AND s.is_active = true
    AND COALESCE(s.is_suspended, false) = false
    AND ST_DWithin(s.location, customer_point, radius_km * 1000.0)
  ORDER BY distance_meters ASC;
END;
$$;

-- ============================================================================
-- 16. REALTIME ENABLEMENT
-- ============================================================================
DO $$
BEGIN
  -- Add tables to realtime publication safely
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- ============================================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for web client
DROP POLICY IF EXISTS "Public full access on users" ON public.users;
CREATE POLICY "Public full access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on customers" ON public.customers;
CREATE POLICY "Public full access on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on shops" ON public.shops;
CREATE POLICY "Public full access on shops" ON public.shops FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on categories" ON public.categories;
CREATE POLICY "Public full access on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on menu_items" ON public.menu_items;
CREATE POLICY "Public full access on menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on orders" ON public.orders;
CREATE POLICY "Public full access on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on order_items" ON public.order_items;
CREATE POLICY "Public full access on order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on payments" ON public.payments;
CREATE POLICY "Public full access on payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on order_status_history" ON public.order_status_history;
CREATE POLICY "Public full access on order_status_history" ON public.order_status_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on favorite_shops" ON public.favorite_shops;
CREATE POLICY "Public full access on favorite_shops" ON public.favorite_shops FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on shop_token_counters" ON public.shop_token_counters;
CREATE POLICY "Public full access on shop_token_counters" ON public.shop_token_counters FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on notifications" ON public.notifications;
CREATE POLICY "Public full access on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on kyc_documents" ON public.kyc_documents;
CREATE POLICY "Public full access on kyc_documents" ON public.kyc_documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on ai_action_logs" ON public.ai_action_logs;
CREATE POLICY "Public full access on ai_action_logs" ON public.ai_action_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 18. STORAGE BUCKETS (Avatars & Shop Images)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
CREATE POLICY "Anyone can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can update avatars" ON storage.objects;
CREATE POLICY "Anyone can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Shop images are publicly readable" ON storage.objects;
CREATE POLICY "Shop images are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'shop-images');

DROP POLICY IF EXISTS "Anyone can upload shop images" ON storage.objects;
CREATE POLICY "Anyone can upload shop images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-images');

DROP POLICY IF EXISTS "Anyone can update shop images" ON storage.objects;
CREATE POLICY "Anyone can update shop images" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-images');

-- ============================================================================
-- COMPLETED SUCCESSFULLY!
-- ============================================================================

