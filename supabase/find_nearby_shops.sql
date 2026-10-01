-- ============================================================================
-- FOODFAX — SAFE POSTGIS + LOCATION MIGRATION
-- Supabase SQL Editor
-- ============================================================================

BEGIN;

-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add missing columns
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS is_mobile_stall BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters INTEGER,
  ADD COLUMN IF NOT EXISTS last_location_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepts_delivery BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS delivery_fee_type TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS delivery_fee_amount NUMERIC DEFAULT 0;

-- 3. Add PostGIS location
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326);

-- 4. Basic validation constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_delivery_radius_nonnegative'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_delivery_radius_nonnegative
      CHECK (
        delivery_radius_km IS NULL OR delivery_radius_km >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_delivery_fee_nonnegative'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_delivery_fee_nonnegative
      CHECK (
        delivery_fee_amount IS NULL OR delivery_fee_amount >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_delivery_fee_type_valid'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_delivery_fee_type_valid
      CHECK (
        delivery_fee_type IS NULL
        OR delivery_fee_type IN ('free', 'fixed')
      );
  END IF;
END $$;

-- 5. Backfill location from existing latitude/longitude
UPDATE public.shops
SET location =
  ST_SetSRID(
    ST_MakePoint(longitude, latitude),
    4326
  )::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

-- 6. Spatial index
CREATE INDEX IF NOT EXISTS idx_shops_location_gist
  ON public.shops
  USING GIST (location);

-- 7. Active/open index
CREATE INDEX IF NOT EXISTS idx_shops_active_open
  ON public.shops (is_active, is_open)
  WHERE location IS NOT NULL;

-- ============================================================================
-- 8. Location synchronization trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_shop_location_coords()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN

  -- Both coordinates available -> generate geography
  IF NEW.latitude IS NOT NULL
     AND NEW.longitude IS NOT NULL THEN

    NEW.location :=
      ST_SetSRID(
        ST_MakePoint(
          NEW.longitude,
          NEW.latitude
        ),
        4326
      )::geography;

  -- Location available -> generate coordinates
  ELSIF NEW.location IS NOT NULL THEN

    NEW.longitude :=
      ST_X(NEW.location::geometry);

    NEW.latitude :=
      ST_Y(NEW.location::geometry);

  -- Coordinates missing -> clear stale location
  ELSE

    NEW.location := NULL;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shop_location_coords
ON public.shops;

CREATE TRIGGER trg_sync_shop_location_coords
BEFORE INSERT OR UPDATE OF latitude, longitude, location
ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.sync_shop_location_coords();

-- ============================================================================
-- 9. Nearby shops RPC
-- ============================================================================

DROP FUNCTION IF EXISTS public.find_nearby_shops(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT
);

CREATE OR REPLACE FUNCTION public.find_nearby_shops(
  customer_lat DOUBLE PRECISION,
  customer_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5.0,
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

  -- Validate coordinates
  IF customer_lat IS NULL
     OR customer_lng IS NULL THEN
    RETURN;
  END IF;

  -- Validate coordinate ranges
  IF customer_lat < -90
     OR customer_lat > 90
     OR customer_lng < -180
     OR customer_lng > 180 THEN
    RAISE EXCEPTION 'Invalid latitude or longitude';
  END IF;

  -- Validate radius
  IF radius_km IS NULL
     OR radius_km <= 0
     OR radius_km > 100 THEN
    RAISE EXCEPTION 'Invalid radius_km';
  END IF;

  -- Validate service type
  IF service_type NOT IN (
    'all',
    'dine_in',
    'takeaway',
    'delivery'
  ) THEN
    RAISE EXCEPTION 'Invalid service_type';
  END IF;

  customer_point :=
    ST_SetSRID(
      ST_MakePoint(
        customer_lng,
        customer_lat
      ),
      4326
    )::geography;

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
    s.is_open,
    COALESCE(s.table_service_available, false),
    COALESCE(s.accepts_delivery, false),
    COALESCE(s.delivery_radius_km, 3.0)::NUMERIC,
    COALESCE(s.delivery_fee_type, 'free')::TEXT,
    COALESCE(s.delivery_fee_amount, 0)::NUMERIC,

    ST_Distance(
      s.location,
      customer_point
    )::DOUBLE PRECISION AS distance_meters,

    ROUND(
      (
        ST_Distance(
          s.location,
          customer_point
        ) / 1000.0
      )::NUMERIC,
      2
    )::DOUBLE PRECISION AS distance_km

  FROM public.shops AS s

  WHERE
    s.location IS NOT NULL

    AND s.is_active = true

    AND s.is_open = true

    AND (

      -- Dine-in
      (
        service_type = 'dine_in'
        AND COALESCE(
          s.table_service_available,
          false
        ) = true
        AND ST_DWithin(
          s.location,
          customer_point,
          radius_km * 1000.0
        )
      )

      OR

      -- Takeaway
      (
        service_type = 'takeaway'
        AND ST_DWithin(
          s.location,
          customer_point,
          radius_km * 1000.0
        )
      )

      OR

      -- Shop Delivery
      (
        service_type = 'delivery'
        AND COALESCE(
          s.accepts_delivery,
          false
        ) = true
        AND ST_DWithin(
          s.location,
          customer_point,
          COALESCE(
            s.delivery_radius_km,
            3.0
          ) * 1000.0
        )
      )

      OR

      -- All
      (
        service_type = 'all'
        AND ST_DWithin(
          s.location,
          customer_point,
          radius_km * 1000.0
        )
      )
    )

  ORDER BY distance_meters ASC;

END;
$$;

-- ============================================================================
-- 10. RPC permissions
-- ============================================================================

REVOKE ALL
ON FUNCTION public.find_nearby_shops(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.find_nearby_shops(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT
)
TO anon, authenticated;

COMMIT;
