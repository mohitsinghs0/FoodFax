-- ============================================================================
-- FoodFax Hardened Production Refund System Migration
-- Migration: 20261107_refund_system.sql
-- 
-- Objectives:
-- 1. Add refund columns to public.orders (refund_status, refund_amount, refund_reason, refund_utr, etc.)
-- 2. Create public.refunds table with unique constraints, checks, and audit timestamps.
-- 3. Configure strict Row Level Security (RLS) for public.refunds.
-- 4. Provide idempotent, race-condition protected RPC: cancel_order_and_request_refund()
-- 5. Provide tamper-proof, admin-only RPC: process_order_refund()
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALTER public.orders TO SUPPORT REFUND AUDITING
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NONE' 
    CHECK (refund_status IN ('NONE', 'REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0 CHECK (refund_amount >= 0),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_utr TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON public.orders(refund_status);

-- ----------------------------------------------------------------------------
-- 2. CREATE public.refunds TABLE WITH UNIQUE CONSTRAINT ON order_id
-- Prevents race conditions and duplicate refund double-payouts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id TEXT,
  customer_phone TEXT,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  refund_type TEXT NOT NULL DEFAULT 'FULL' CHECK (refund_type IN ('FULL', 'PARTIAL')),
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
  reason TEXT,
  gateway_refund_id TEXT,
  gateway_utr TEXT,
  processed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_shop_id ON public.refunds(shop_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer_id ON public.refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) FOR public.refunds
-- ----------------------------------------------------------------------------
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated customers can view refunds for their own orders
DROP POLICY IF EXISTS "Customers view own refunds" ON public.refunds;
CREATE POLICY "Customers view own refunds"
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()::text 
    OR customer_phone = (auth.jwt() ->> 'phone')
  );

-- Policy 2: Shop owners can view refunds for their own stall
DROP POLICY IF EXISTS "Shop owners view stall refunds" ON public.refunds;
CREATE POLICY "Shop owners view stall refunds"
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE shops.id = refunds.shop_id
        AND shops.owner_id = auth.uid()::text
    )
  );

-- Policy 3: Platform admins have full visibility and management over refunds
DROP POLICY IF EXISTS "Admins full manage refunds" ON public.refunds;
CREATE POLICY "Admins full manage refunds"
  ON public.refunds
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. HARDENED RPC: cancel_order_and_request_refund
-- Idempotent, terminal-state protected, and anti-replay
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order_and_request_refund(
  p_order_id TEXT,
  p_reason TEXT DEFAULT 'Customer cancelled before acceptance',
  p_cancelled_by TEXT DEFAULT 'customer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_refund RECORD;
  v_refund_id TEXT;
  v_is_paid BOOLEAN;
  v_now TIMESTAMPTZ := NOW();
  v_clean_reason TEXT;
BEGIN
  -- Sanitize reason
  v_clean_reason := regexp_replace(p_reason, '<[^>]*>', '', 'g');
  IF length(v_clean_reason) > 200 THEN
    v_clean_reason := substring(v_clean_reason from 1 for 200);
  END IF;

  -- 1. Fetch order with row-level lock
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order with ID % not found', p_order_id;
  END IF;

  -- 2. Idempotency Check: if already cancelled, return existing state without duplicate refund
  IF v_order.order_status = 'CANCELLED' THEN
    SELECT id INTO v_refund_id FROM public.refunds WHERE order_id = p_order_id;
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'order_status', 'CANCELLED',
      'refund_status', COALESCE(v_order.refund_status, 'REQUESTED'),
      'refund_amount', COALESCE(v_order.refund_amount, v_order.total),
      'refund_id', v_refund_id,
      'already_cancelled', true
    );
  END IF;

  -- 3. Terminal State Check: Completed orders CANNOT be cancelled
  IF v_order.order_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Order has already been completed and delivered. Cancellations are strictly locked.';
  END IF;

  -- 4. Authorization & Cancellation Rules
  -- Customer can ONLY cancel if order_status is PENDING (pre-kitchen acceptance)
  IF p_cancelled_by = 'customer' THEN
    IF v_order.order_status != 'PENDING' THEN
      RAISE EXCEPTION 'Order has already been accepted by the kitchen (Status: %). Cancellations are strictly locked once cooking begins.', v_order.order_status;
    END IF;
  END IF;

  -- Check if order was paid online
  v_is_paid := (v_order.payment_method = 'PAY_ONLINE' OR v_order.payment_status = 'PAID');

  -- 5. Update Order Status
  UPDATE public.orders
  SET 
    order_status = 'CANCELLED',
    cancellation_reason = v_clean_reason,
    cancelled_at = v_now,
    cancelled_by = p_cancelled_by,
    updated_at = v_now,
    refund_status = CASE WHEN v_is_paid AND v_order.total > 0 THEN 'REQUESTED' ELSE 'NONE' END,
    refund_amount = CASE WHEN v_is_paid AND v_order.total > 0 THEN v_order.total ELSE 0 END,
    refund_reason = CASE WHEN v_is_paid AND v_order.total > 0 THEN v_clean_reason ELSE NULL END,
    refund_requested_at = CASE WHEN v_is_paid AND v_order.total > 0 THEN v_now ELSE NULL END
  WHERE id = p_order_id;

  -- 6. If paid online, record in public.refunds table (with ON CONFLICT idempotency)
  IF v_is_paid AND v_order.total > 0 THEN
    INSERT INTO public.refunds (
      order_id,
      customer_id,
      customer_phone,
      shop_id,
      amount,
      refund_type,
      status,
      reason,
      created_at,
      updated_at
    )
    VALUES (
      p_order_id,
      v_order.customer_id,
      v_order.customer_phone,
      v_order.shop_id,
      v_order.total,
      'FULL',
      'REQUESTED',
      v_clean_reason,
      v_now,
      v_now
    )
    ON CONFLICT (order_id) DO UPDATE SET
      status = 'REQUESTED',
      reason = EXCLUDED.reason,
      updated_at = v_now
    RETURNING id INTO v_refund_id;

    -- Update payments table status
    UPDATE public.payments
    SET 
      payment_status = 'REFUND_PENDING',
      updated_at = v_now
    WHERE order_id = p_order_id;
  END IF;

  -- 7. Audit log in order_status_history
  INSERT INTO public.order_status_history (
    id,
    order_id,
    old_status,
    new_status,
    changed_by,
    note,
    created_at
  )
  VALUES (
    p_order_id || '-status-' || extract(epoch from v_now)::text,
    p_order_id,
    v_order.order_status,
    'CANCELLED',
    p_cancelled_by,
    'Order cancelled by ' || p_cancelled_by || ': ' || v_clean_reason || CASE WHEN v_is_paid THEN ' (100% refund ₹' || v_order.total || ' requested to original payment source)' ELSE '' END,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_status', 'CANCELLED',
    'refund_status', CASE WHEN v_is_paid AND v_order.total > 0 THEN 'REQUESTED' ELSE 'NONE' END,
    'refund_amount', CASE WHEN v_is_paid AND v_order.total > 0 THEN v_order.total ELSE 0 END,
    'refund_id', v_refund_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. HARDENED RPC: process_order_refund (Admin / System Only)
-- Completes or rejects a refund and records verified bank UTR
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_order_refund(
  p_refund_id TEXT,
  p_utr TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'COMPLETED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_clean_utr TEXT;
BEGIN
  -- Strict Admin check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only platform administrators can process refunds.';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund record % not found.', p_refund_id;
  END IF;

  -- Disallow re-completing an already completed refund
  IF v_refund.status = 'COMPLETED' AND p_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'This refund has already been completed with Bank UTR: %', v_refund.gateway_utr;
  END IF;

  -- Validate 12-digit UTR if completing
  IF p_status = 'COMPLETED' THEN
    v_clean_utr := regexp_replace(COALESCE(p_utr, ''), '\s+', '', 'g');
    IF NOT (v_clean_utr ~ '^[0-9]{12}$') THEN
      RAISE EXCEPTION 'Invalid Bank UTR: Must be strictly 12 numeric digits.';
    END IF;
    IF v_clean_utr LIKE '0%' THEN
      RAISE EXCEPTION 'Invalid Bank UTR: NPCI UTR never starts with 0.';
    END IF;
  ELSE
    v_clean_utr := p_utr;
  END IF;

  -- Update refunds table
  UPDATE public.refunds
  SET 
    status = p_status,
    gateway_utr = COALESCE(v_clean_utr, gateway_utr),
    processed_by = auth.uid()::text,
    updated_at = v_now
  WHERE id = p_refund_id;

  -- Update orders table
  UPDATE public.orders
  SET 
    refund_status = p_status,
    refund_utr = COALESCE(v_clean_utr, refund_utr),
    refund_completed_at = CASE WHEN p_status = 'COMPLETED' THEN v_now ELSE NULL END,
    updated_at = v_now
  WHERE id = v_refund.order_id;

  -- Update payments table
  IF p_status = 'COMPLETED' THEN
    UPDATE public.payments
    SET 
      payment_status = 'REFUNDED',
      updated_at = v_now
    WHERE order_id = v_refund.order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'refund_id', p_refund_id,
    'order_id', v_refund.order_id,
    'status', p_status,
    'utr', v_clean_utr
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_order_refund(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_order_refund(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_order_refund(TEXT, TEXT, TEXT) TO authenticated;
