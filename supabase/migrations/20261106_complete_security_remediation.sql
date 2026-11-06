-- ============================================================================
-- FoodFax Comprehensive Production Security Remediation Migration
-- Date: November 2026
-- 
-- Objectives:
-- 1. DROP all insecure "Public full access *" and "Anon manage *" policies (USING true WITH CHECK true).
-- 2. Implement non-recursive SECURITY DEFINER helper functions for RBAC (is_admin, is_shop_owner).
-- 3. Secure public.users and public.customers:
--    - Prevent anonymous dumping of user data.
--    - Revoke SELECT on password and password_hash columns from anon and authenticated.
--    - Prevent regular users from escalating their own role to 'admin' or 'super_admin'.
-- 4. Provide secure check_user_exists() RPC function for login screens (no PII/password leakage).
-- 5. Secure public.orders, public.order_items, and public.payments:
--    - Allow order placement.
--    - Disallow unauthorized updates or deletions of orders/payments by anon users.
--    - Strictly protect payment status modification (only service_role / admins / shop owners).
-- 6. Secure KYC documents and admin audit logs:
--    - Only authorized shop owners and platform admins can access sensitive verification data.
-- 7. Secure storage buckets (avatars, shop-images, kyc_documents).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP ALL INSECURE BYPASS POLICIES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Users
  DROP POLICY IF EXISTS "Public full access on users" ON public.users;
  DROP POLICY IF EXISTS "Anon manage users" ON public.users;
  DROP POLICY IF EXISTS "Allow all access to users" ON public.users;

  -- Customers
  DROP POLICY IF EXISTS "Public full access on customers" ON public.customers;
  DROP POLICY IF EXISTS "Anon manage customers" ON public.customers;
  DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;

  -- Orders
  DROP POLICY IF EXISTS "Public full access on orders" ON public.orders;
  DROP POLICY IF EXISTS "Public manage orders" ON public.orders;
  DROP POLICY IF EXISTS "Anon manage orders" ON public.orders;

  -- Order Items
  DROP POLICY IF EXISTS "Public full access on order_items" ON public.order_items;
  DROP POLICY IF EXISTS "Public manage order_items" ON public.order_items;
  DROP POLICY IF EXISTS "Anon manage order_items" ON public.order_items;

  -- Payments
  DROP POLICY IF EXISTS "Public full access on payments" ON public.payments;
  DROP POLICY IF EXISTS "Public manage payments" ON public.payments;
  DROP POLICY IF EXISTS "Anon manage payments" ON public.payments;

  -- KYC Documents & Verifications
  DROP POLICY IF EXISTS "Public full access on kyc_documents" ON public.kyc_documents;
  DROP POLICY IF EXISTS "Public full access on shop_verification_documents" ON public.shop_verification_documents;
  DROP POLICY IF EXISTS "Public full access on shop_verification_requests" ON public.shop_verification_requests;

  -- AI Action Logs & Notifications
  DROP POLICY IF EXISTS "Public full access on ai_action_logs" ON public.ai_action_logs;
  DROP POLICY IF EXISTS "Public full access on notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Anon manage notifications" ON public.notifications;
END $$;


-- ----------------------------------------------------------------------------
-- 2. SECURITY DEFINER AUTHORIZATION HELPERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(lookup_user_id text DEFAULT auth.uid()::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  IF lookup_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Fast check trusted JWT app_metadata (set only via service-role / GoTrue)
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin') THEN
    RETURN true;
  END IF;

  -- 2. Check public.users table (executed under function owner context, avoiding recursion)
  IF to_regclass('public.users') IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.users
      WHERE id = lookup_user_id
        AND role IN ('admin', 'super_admin')
        AND (is_active IS NULL OR is_active IS TRUE)
    );
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(text) TO service_role;


CREATE OR REPLACE FUNCTION public.is_shop_owner(target_shop_id text, lookup_user_id text DEFAULT auth.uid()::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  IF lookup_user_id IS NULL OR target_shop_id IS NULL THEN
    RETURN false;
  END IF;

  IF to_regclass('public.shops') IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.shops
      WHERE id = target_shop_id
        AND owner_id = lookup_user_id
    );
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_shop_owner(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_shop_owner(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_owner(text, text) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. SAFE ACCOUNT EXISTENCE RPC (Solves Login Lookup without PII/Password Leak)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_exists(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clean_digits text;
  last10 text;
  is_found boolean := false;
  found_role text := null;
BEGIN
  IF p_identifier IS NULL OR length(trim(p_identifier)) = 0 THEN
    RETURN jsonb_build_object('exists', false, 'role', null);
  END IF;

  clean_digits := regexp_replace(p_identifier, '\D', '', 'g');
  last10 := substring(clean_digits from length(clean_digits) - 9 for 10);

  IF p_identifier LIKE '%@%' THEN
    SELECT true, role INTO is_found, found_role 
    FROM public.users 
    WHERE lower(email) = lower(trim(p_identifier)) 
    LIMIT 1;

    IF NOT is_found AND to_regclass('public.customers') IS NOT NULL THEN
      SELECT true, 'customer' INTO is_found, found_role 
      FROM public.customers 
      WHERE lower(email) = lower(trim(p_identifier)) 
      LIMIT 1;
    END IF;
  ELSEIF length(last10) = 10 THEN
    SELECT true, role INTO is_found, found_role 
    FROM public.users 
    WHERE phone LIKE '%' || last10 
    LIMIT 1;

    IF NOT is_found AND to_regclass('public.customers') IS NOT NULL THEN
      SELECT true, 'customer' INTO is_found, found_role 
      FROM public.customers 
      WHERE phone LIKE '%' || last10 
      LIMIT 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'exists', coalesce(is_found, false),
    'role', coalesce(found_role, 'customer')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_exists(text) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. HARDEN public.users & COLUMN ACCESS
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Revoke SELECT on password columns from public roles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password') THEN
    REVOKE SELECT (password) ON TABLE public.users FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash') THEN
    REVOKE SELECT (password_hash) ON TABLE public.users FROM anon, authenticated;
  END IF;
END $$;

-- Policy: Admins have full access
DROP POLICY IF EXISTS "Admins full access to users" ON public.users;
CREATE POLICY "Admins full access to users"
  ON public.users FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Users can read their own profile
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
CREATE POLICY "Users read own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid()::text);

-- Policy: Users can update own profile (PREVENTING role escalation)
DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (
    id = auth.uid()::text AND
    -- Cannot escalate to admin via client update
    role NOT IN ('admin', 'super_admin')
  );


-- ----------------------------------------------------------------------------
-- 5. HARDEN public.customers
-- ----------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'password') THEN
    REVOKE SELECT (password) ON TABLE public.customers FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'password_hash') THEN
    REVOKE SELECT (password_hash) ON TABLE public.customers FROM anon, authenticated;
  END IF;
END $$;

-- Policy: Admins full access
DROP POLICY IF EXISTS "Admins full access to customers" ON public.customers;
CREATE POLICY "Admins full access to customers"
  ON public.customers FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Customers read own profile
DROP POLICY IF EXISTS "Customers read own profile" ON public.customers;
CREATE POLICY "Customers read own profile"
  ON public.customers FOR SELECT TO authenticated
  USING (id = auth.uid()::text);

-- Policy: Customers update own profile
DROP POLICY IF EXISTS "Customers update own profile" ON public.customers;
CREATE POLICY "Customers update own profile"
  ON public.customers FOR UPDATE TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Policy: Registration insert
DROP POLICY IF EXISTS "Customers self registration" ON public.customers;
CREATE POLICY "Customers self registration"
  ON public.customers FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() IS NULL OR id = auth.uid()::text);


-- ----------------------------------------------------------------------------
-- 6. HARDEN public.orders & public.order_items
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders: Admins full access
DROP POLICY IF EXISTS "Admins full access to orders" ON public.orders;
CREATE POLICY "Admins full access to orders"
  ON public.orders FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Orders: Shop owners manage orders of their own shop
DROP POLICY IF EXISTS "Shop owners manage shop orders" ON public.orders;
CREATE POLICY "Shop owners manage shop orders"
  ON public.orders FOR ALL TO authenticated
  USING (public.is_shop_owner(shop_id))
  WITH CHECK (public.is_shop_owner(shop_id));

-- Orders: Customers read their own orders
DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
CREATE POLICY "Customers read own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid()::text);

-- Orders: Allow authenticated and guest order inserts (status must start as PENDING)
DROP POLICY IF EXISTS "Customers insert orders" ON public.orders;
CREATE POLICY "Customers insert orders"
  ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (
    payment_status IN ('PENDING', 'UNPAID')
  );

-- Order Items: Admins full access
DROP POLICY IF EXISTS "Admins full access to order items" ON public.order_items;
CREATE POLICY "Admins full access to order items"
  ON public.order_items FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Order Items: Shop owners read their shop's line items
DROP POLICY IF EXISTS "Shop owners read shop order items" ON public.order_items;
CREATE POLICY "Shop owners read shop order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND public.is_shop_owner(o.shop_id)
  ));

-- Order Items: Customers read their own line items
DROP POLICY IF EXISTS "Customers read own order items" ON public.order_items;
CREATE POLICY "Customers read own order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()::text
  ));

-- Order Items: Insert allowed during order placement
DROP POLICY IF EXISTS "Allow insert order items" ON public.order_items;
CREATE POLICY "Allow insert order items"
  ON public.order_items FOR INSERT TO anon, authenticated
  WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- 7. HARDEN public.payments
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Payments: Admins full access
DROP POLICY IF EXISTS "Admins full access to payments" ON public.payments;
CREATE POLICY "Admins full access to payments"
  ON public.payments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Payments: Shop owners read payments of their shop
DROP POLICY IF EXISTS "Shop owners read shop payments" ON public.payments;
CREATE POLICY "Shop owners read shop payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_shop_owner(shop_id));

-- Payments: Customers read own payment rows
DROP POLICY IF EXISTS "Customers read own payments" ON public.payments;
CREATE POLICY "Customers read own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (customer_id = auth.uid()::text);

-- Payments: Customer initial payment row creation
DROP POLICY IF EXISTS "Customers insert payments" ON public.payments;
CREATE POLICY "Customers insert payments"
  ON public.payments FOR INSERT TO anon, authenticated
  WITH CHECK (
    payment_status IN ('PENDING', 'INITIATED')
  );

-- NOTICE: UPDATE on payments is NOT granted to anon or customer authenticated users!
-- Updates (marking PAID) can only be performed by service_role (paymentHandler / webhook) or admin.


-- ----------------------------------------------------------------------------
-- 8. HARDEN KYC DOCUMENTS & VERIFICATION REQUESTS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.kyc_documents') IS NOT NULL THEN
    ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.kyc_documents FROM anon;

    DROP POLICY IF EXISTS "Admins full access on kyc_documents" ON public.kyc_documents;
    CREATE POLICY "Admins full access on kyc_documents"
      ON public.kyc_documents FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    DROP POLICY IF EXISTS "Owners manage own kyc_documents" ON public.kyc_documents;
    CREATE POLICY "Owners manage own kyc_documents"
      ON public.kyc_documents FOR ALL TO authenticated
      USING (public.is_shop_owner(shop_id))
      WITH CHECK (public.is_shop_owner(shop_id));
  END IF;

  IF to_regclass('public.shop_verification_requests') IS NOT NULL THEN
    ALTER TABLE public.shop_verification_requests ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.shop_verification_requests FROM anon;

    DROP POLICY IF EXISTS "Admins full access on verification requests" ON public.shop_verification_requests;
    CREATE POLICY "Admins full access on verification requests"
      ON public.shop_verification_requests FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    DROP POLICY IF EXISTS "Owners access own verification requests" ON public.shop_verification_requests;
    CREATE POLICY "Owners access own verification requests"
      ON public.shop_verification_requests FOR SELECT TO authenticated
      USING (owner_id = auth.uid()::text OR public.is_shop_owner(shop_id));

    DROP POLICY IF EXISTS "Owners insert own verification requests" ON public.shop_verification_requests;
    CREATE POLICY "Owners insert own verification requests"
      ON public.shop_verification_requests FOR INSERT TO authenticated
      WITH CHECK (owner_id = auth.uid()::text OR public.is_shop_owner(shop_id));
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 9. HARDEN STORAGE BUCKET POLICIES (Avatars & Shop Images)
-- ----------------------------------------------------------------------------
-- Ensure buckets exist
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-images', 'shop-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc_documents', 'kyc_documents', false) ON CONFLICT (id) DO NOTHING;

-- Public read for avatars and shop images
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Shop images are publicly readable" ON storage.objects;
CREATE POLICY "Shop images are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'shop-images');

-- Authenticated write only (reject anonymous arbitrary file injection)
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update avatars" ON storage.objects;
CREATE POLICY "Authenticated users update avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated owners upload shop images" ON storage.objects;
CREATE POLICY "Authenticated owners upload shop images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-images');

DROP POLICY IF EXISTS "Anyone can update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated owners update shop images" ON storage.objects;
CREATE POLICY "Authenticated owners update shop images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-images');

