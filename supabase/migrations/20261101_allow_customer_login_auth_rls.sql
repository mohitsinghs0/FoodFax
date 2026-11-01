-- ============================================================================
-- FoodFax Migration: Allow Public & Anon Read/Write on customers and users
-- Resolves "No account found for this mobile number or email" on login
-- ============================================================================

-- 1. Ensure customers table allows public/anon and authenticated customer lookups and registration
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;
DROP POLICY IF EXISTS "Public full access on customers" ON public.customers;
CREATE POLICY "Public full access on customers" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Ensure users table allows public/anon and authenticated lookups for login
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access on users" ON public.users;
CREATE POLICY "Public full access on users" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

