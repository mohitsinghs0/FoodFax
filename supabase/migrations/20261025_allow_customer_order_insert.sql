-- ============================================================================
-- FoodFax Migration: Fix Customer Order Row-Level Security (RLS) Policy
-- Execute in Supabase SQL Editor if customer order placement encounters RLS errors
-- ============================================================================

-- 1. Ensure orders table allows public/anon and authenticated customer inserts
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access on orders" ON public.orders;
CREATE POLICY "Public full access on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 2. Ensure order_items allows inserts
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access on order_items" ON public.order_items;
CREATE POLICY "Public full access on order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- 3. Ensure payments table allows inserts
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access on payments" ON public.payments;
CREATE POLICY "Public full access on payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

