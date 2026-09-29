-- ============================================================================
-- FoodFax — Dedicated Customers Table Migration
-- Run this in Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard/project/aftmqdmiwvpbpsdmsfbu/sql)
-- ============================================================================

-- 1. Create dedicated customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  password TEXT NOT NULL,
  password_hash TEXT,
  email TEXT,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  area TEXT,
  city TEXT,
  pincode TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  saved_shop_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_location TEXT,
  profile_completed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fast lookup indexes for phone and email
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policy to allow seamless authenticated and anon customer operations
DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;
CREATE POLICY "Allow all access to customers" ON public.customers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Ensure public.users table columns exist for complete backward compatibility
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 6. Add customers table to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'customers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
