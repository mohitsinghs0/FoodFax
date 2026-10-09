-- ============================================================================
-- FOODFAX DATABASE MIGRATION: UPIQRPAY PAYMENT INTEGRATION
-- Supports multi-merchant dynamic QR, webhook verification, and state tracking
-- ============================================================================

-- 1. Extend public.shops with multi-merchant UPIQRPay configuration
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS upiqrpay_api_key TEXT,
  ADD COLUMN IF NOT EXISTS upiqrpay_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS is_online_payment_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS merchant_provider TEXT DEFAULT 'bharatpe';

COMMENT ON COLUMN public.shops.upiqrpay_api_key IS 'Shop-specific UPIQRPay API Key for direct merchant settlement';
COMMENT ON COLUMN public.shops.upiqrpay_webhook_secret IS 'Shop-specific Webhook Secret for HMAC-SHA256 signature verification';
COMMENT ON COLUMN public.shops.is_online_payment_enabled IS 'Controls whether customer can pay online via UPI for this shop';

-- 2. Update public.orders payment_status check constraint to support full lifecycle
-- Payment statuses: PENDING, INITIATED, PROCESSING, PAID, FAILED, CANCELLED, EXPIRED, REFUNDED, COLLECT_ON_DELIVERY
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'orders' AND constraint_name = 'orders_payment_status_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_payment_status_check;
  END IF;

  -- Add updated comprehensive check constraint
  ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
    CHECK (payment_status IN (
      'PENDING', 
      'INITIATED', 
      'PROCESSING', 
      'PAID', 
      'FAILED', 
      'CANCELLED', 
      'EXPIRED', 
      'REFUNDED', 
      'COLLECT_ON_DELIVERY'
    ));
END $$;

-- 3. Extend public.payments table for full audit trail & UPIQRPay attributes
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS shop_id TEXT REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS merchant_ref TEXT,
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
  ADD COLUMN IF NOT EXISTS upi_intent_url TEXT,
  ADD COLUMN IF NOT EXISTS utr_number TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- 4. Create performance indexes for lookups
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON public.payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_utr_number ON public.payments(utr_number);

-- 5. Enable Realtime publication on public.payments and public.orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Realtime publication might already be configured or require superuser
    NULL;
END $$;

