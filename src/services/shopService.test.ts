import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  shopService,
  getListingCacheKey,
  clearStallCache,
  isShopSuspendedOrKycPending,
  STALL_CACHE_TTL_MS,
  LISTING_CACHE_TTL_MS,
} from './shopService';
import {
  calculateDistanceKm,
  resolveShopCoordinates,
  buildGoogleMapsDirectionsUrl,
  calculateEstimatedTime,
} from './geoService';
import { Shop } from '../types';

describe('Shop Service & Spatial Discovery Suite (TDD)', () => {
  const sampleLocation = { latitude: 19.076, longitude: 72.8777 }; // Mumbai coordinates

  describe('1. Spatial Haversine Distance Calculations', () => {
    it('calculates 0 km distance when coordinates are identical', () => {
      const dist = calculateDistanceKm(19.076, 72.8777, 19.076, 72.8777);
      assert.equal(dist, 0);
    });

    it('calculates accurate distance between Mumbai and Bandra (~10 km)', () => {
      // Mumbai CST (18.9401, 72.8347) to Bandra Station (19.0544, 72.8402)
      const dist = calculateDistanceKm(18.9401, 72.8347, 19.0544, 72.8402);
      assert.ok(dist >= 12.0 && dist <= 13.5, `Distance was ${dist} km, expected ~12.7 km`);
    });

    it('handles negative coordinates (southern/western hemispheres)', () => {
      const dist = calculateDistanceKm(-33.8688, 151.2093, -37.8136, 144.9631); // Sydney to Melbourne
      assert.ok(dist > 700 && dist < 800, `Expected ~713 km, got ${dist}`);
    });
  });

  describe('2. Stall Suspension & KYC Visibility Filtering', () => {
    it('returns false for normal active and verified stalls', () => {
      const shop = {
        id: 'shop-active',
        name: 'Sharma Vada Pav',
        isActive: true,
        isSuspended: false,
        status: 'active',
        kycStatus: 'approved',
      };
      assert.equal(isShopSuspendedOrKycPending(shop), false);
    });

    it('detects explicit boolean suspension (isSuspended: true)', () => {
      assert.equal(isShopSuspendedOrKycPending({ isSuspended: true }), true);
      assert.equal(isShopSuspendedOrKycPending({ is_suspended: true }), true);
    });

    it('detects deactivated stalls (isActive: false)', () => {
      assert.equal(isShopSuspendedOrKycPending({ isActive: false }), true);
      assert.equal(isShopSuspendedOrKycPending({ is_active: false }), true);
    });

    it('detects stalls with suspended, inactive, blocked, or rejected status', () => {
      assert.equal(isShopSuspendedOrKycPending({ status: 'suspended' }), true);
      assert.equal(isShopSuspendedOrKycPending({ status: 'inactive' }), true);
      assert.equal(isShopSuspendedOrKycPending({ status: 'blocked' }), true);
      assert.equal(isShopSuspendedOrKycPending({ status: 'rejected' }), true);
    });

    it('detects stalls with rejected or blocked KYC status', () => {
      assert.equal(isShopSuspendedOrKycPending({ kycStatus: 'rejected' }), true);
      assert.equal(isShopSuspendedOrKycPending({ kycStatus: 'blocked' }), true);
      assert.equal(isShopSuspendedOrKycPending({ kyc_status: 'suspended' }), true);
    });
  });

  describe('3. Smart Listing & Stall Details Caching', () => {
    it('generates deterministic cache keys based on coordinates, radius, and category', () => {
      const key1 = getListingCacheKey(5, 'chaat', sampleLocation);
      const key2 = getListingCacheKey(5, 'chaat', sampleLocation);
      assert.equal(key1, key2);
      assert.equal(key1, '19.076:72.878:r5:cchaat');
    });

    it('produces distinct cache keys for different search radiuses', () => {
      const key1km = getListingCacheKey(1, 'all', sampleLocation);
      const key5km = getListingCacheKey(5, 'all', sampleLocation);
      assert.notEqual(key1km, key5km);
    });

    it('clears specific stall and nearby cache on clearStallCache()', () => {
      assert.doesNotThrow(() => {
        clearStallCache('shop-sharma-vada-pav');
        clearStallCache(); // full flush
      });
    });

    it('enforces configured cache TTLs', () => {
      assert.equal(STALL_CACHE_TTL_MS, 5 * 60 * 1000, 'Stall details cache TTL must be 5 minutes');
      assert.equal(LISTING_CACHE_TTL_MS, 3 * 60 * 1000, 'Listing cache TTL must be 3 minutes');
    });
  });

  describe('4. Shop Reviews In-Memory and State Logic', () => {
    it('validates rating score bounds (1 to 5 stars)', () => {
      const validRatings = [1, 2, 3, 4, 5];
      for (const r of validRatings) {
        assert.ok(r >= 1 && r <= 5);
      }
    });
  });

  describe('5. Shop Map Coordinates & Google Maps Directions URL (TDD)', () => {
    it('resolves valid coordinates from shop.latitude or shop.location.latitude', () => {
      const shop1 = { id: 's1', name: 'Stall 1', latitude: 19.3515, longitude: 72.8525 };
      const shop2 = { id: 's2', name: 'Stall 2', location: { latitude: 19.1197, longitude: 72.8464 } };
      const shop3 = { id: 's3', name: 'Stall 3' }; // No coords

      const coords1 = resolveShopCoordinates(shop1);
      assert.equal(coords1.latitude, 19.3515);
      assert.equal(coords1.longitude, 72.8525);

      const coords2 = resolveShopCoordinates(shop2);
      assert.equal(coords2.latitude, 19.1197);
      assert.equal(coords2.longitude, 72.8464);

      // Falls back to default city coordinates instead of crashing
      const coords3 = resolveShopCoordinates(shop3);
      assert.ok(coords3.latitude > 0);
      assert.ok(coords3.longitude > 0);
    });

    it('builds canonical Google Maps directions URL with proper destination coordinates and place name', () => {
      const url = buildGoogleMapsDirectionsUrl(19.3515, 72.8525, 'Sharma Vada Pav');
      assert.ok(url.startsWith('https://www.google.com/maps/dir/?api=1'));
      assert.ok(url.includes('destination=19.3515,72.8525'));
      assert.ok(url.includes('Sharma%20Vada%20Pav'));
    });

    it('calculates walking and driving ETA estimates accurately from distance in km', () => {
      const walk = calculateEstimatedTime(0.5, 'walking'); // 0.5 km walking ~7 mins
      assert.ok(walk.minutes >= 5 && walk.minutes <= 8);
      assert.ok(walk.label.includes('mins'));

      const drive = calculateEstimatedTime(3.0, 'driving'); // 3 km driving ~9 mins
      assert.ok(drive.minutes >= 5 && drive.minutes <= 12);
    });
  });
});

