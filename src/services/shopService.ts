import { Shop, ShopCategory, MenuItem, ShopReview } from '../types';
import { MOCK_CATEGORIES, MOCK_SHOPS } from '../data/mockData';
import { firestoreSync, MOCK_SHOP_IDS, normalizeShopDoc } from './firestoreSyncService';
import { calculateDistanceKm, DEFAULT_CUSTOMER_LOCATION } from './geoService';
import { isSupabaseConfigured } from '../supabase';

// Storage keys for persistence
const SHOPS_STORAGE_KEY = 'foodflow_shops_list';
const SAVED_SHOPS_KEY = 'foodflow_saved_shops';
const REVIEWS_STORAGE_KEY = 'foodflow_shop_reviews';
const IN_MEMORY_REVIEWS: ShopReview[] = [];

let memoryStoredShopsCache: Shop[] | null = null;

// Sub-50ms API Caching (5-minute TTL) for stall details
export const STALL_CACHE_TTL_MS = 5 * 60 * 1000;
interface StallCacheEntry {
  data: Shop;
  timestamp: number;
}
const STALL_DETAILS_CACHE = new Map<string, StallCacheEntry>();

// Location & Radius Keyed Listing Cache (3-minute TTL)
export const LISTING_CACHE_TTL_MS = 3 * 60 * 1000;
interface ListingCacheEntry {
  data: Shop[];
  timestamp: number;
}
const NEARBY_LISTING_CACHE = new Map<string, ListingCacheEntry>();

export function getListingCacheKey(
  radiusKm?: number,
  category?: string,
  userLocation?: { latitude: number; longitude: number }
): string {
  const lat = userLocation?.latitude ? userLocation.latitude.toFixed(3) : 'def_lat';
  const lng = userLocation?.longitude ? userLocation.longitude.toFixed(3) : 'def_lng';
  return `${lat}:${lng}:r${radiusKm ?? 'all'}:c${category ?? 'all'}`;
}

export function clearStallCache(shopId?: string): void {
  if (shopId) {
    STALL_DETAILS_CACHE.delete(shopId.toLowerCase());
  } else {
    STALL_DETAILS_CACHE.clear();
  }
  NEARBY_LISTING_CACHE.clear();
}

const SHOP_LISTENERS = new Map<string, Set<(shop: Shop) => void>>();
const ALL_SHOPS_LISTENERS = new Set<(shops: Shop[]) => void>();

// Verified authentic registered stall seed for live users
export const INITIAL_REAL_SHOPS: Shop[] = [];

/**
 * Checks whether a shop is explicitly suspended, inactive, blocked, or rejected.
 */
export function isShopSuspendedOrKycPending(shop: any): boolean {
  if (!shop) return false;

  // 1. Explicit boolean suspension flag
  if (shop.isSuspended === true || shop.is_suspended === true) {
    return true;
  }

  // 2. Explicit active flag (false = suspended/deactivated)
  if (shop.isActive === false || shop.is_active === false) {
    return true;
  }

  // 3. Status string check (only block explicitly suspended/inactive/blocked/rejected)
  const status = String(shop.status || shop.shop_status || '').toLowerCase().trim();
  if (['suspended', 'inactive', 'blocked', 'rejected'].includes(status)) {
    return true;
  }

  // 4. KYC status check (only block if explicitly rejected/suspended/blocked)
  const kycStatus = String(shop.kycStatus || shop.kyc_status || '').toLowerCase().trim();
  if (['rejected', 'suspended', 'blocked'].includes(kycStatus)) {
    return true;
  }

  return false;
}

export const shopService = {
  isRealUserCheck(override?: boolean): boolean {
    if (override !== undefined) return override;
    try {
      const stored = localStorage.getItem('foodflow_auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && !u.isDemo && u.id !== 'demo-customer-001' && u.id !== 'demo-owner-001') {
          return true;
        }
      }
    } catch {
      // fallback
    }
    return false; // Default to demo / visitor interactive mode
  },

  getStoredShops(isRealUser?: boolean): Shop[] {
    const deletedRaw = typeof window !== 'undefined' ? localStorage.getItem('foodflow_deleted_shops') : null;
    const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);

    try {
      const rawPrimary = typeof window !== 'undefined' ? localStorage.getItem('foodflow_shops') : null;
      const rawSecondary = typeof window !== 'undefined' ? localStorage.getItem(SHOPS_STORAGE_KEY) : null;
      const listPrimary: Shop[] = rawPrimary ? JSON.parse(rawPrimary) : [];
      const listSecondary: Shop[] = rawSecondary ? JSON.parse(rawSecondary) : [];
      const combined = [
        ...(Array.isArray(listPrimary) ? listPrimary : []),
        ...(Array.isArray(listSecondary) ? listSecondary : []),
      ];

      if (combined.length > 0) {
        const map = new Map<string, Shop>();
        combined.forEach((s) => {
          if (
            s && 
            s.id && 
            s.name && 
            !s.isDemo && 
            !MOCK_SHOP_IDS.has(s.id) && 
            s.id !== 'shop-411159' && 
            s.slug !== 'deepak-chinese-corner' && 
            !deletedSet.has(s.id) && 
            !isShopSuspendedOrKycPending(s) && 
            !map.has(s.id)
          ) {
            map.set(s.id, s);
          }
        });

        const cleanList = Array.from(map.values());
        memoryStoredShopsCache = cleanList;
        return cleanList;
      }
    } catch {
      // fallback
    }

    if (memoryStoredShopsCache && memoryStoredShopsCache.length > 0) {
      return memoryStoredShopsCache;
    }

    if (!isSupabaseConfigured) {
      return MOCK_SHOPS.filter((s) => !deletedSet.has(s.id) && !isShopSuspendedOrKycPending(s));
    }

    return [];
  },

  saveStoredShops(shops: Shop[]): void {
    memoryStoredShopsCache = shops;
    try {
      const serialized = JSON.stringify(shops);
      localStorage.setItem(SHOPS_STORAGE_KEY, serialized);
      localStorage.setItem('foodflow_shops', serialized);
    } catch {
      // fallback
    }
  },

  subscribeToShops(callback: (shops: Shop[]) => void): () => void {
    ALL_SHOPS_LISTENERS.add(callback);
    // Also connect to remote Supabase realtime if configured
    const unsubRemote = firestoreSync.subscribeToShopList((liveShops) => {
      callback(liveShops);
    });

    return () => {
      ALL_SHOPS_LISTENERS.delete(callback);
      unsubRemote();
    };
  },

  notifyAllShopsListeners(): void {
    this.getNearbyShops().then((shops) => {
      ALL_SHOPS_LISTENERS.forEach((listener) => {
        try {
          listener(shops);
        } catch (e) {
          console.error(e);
        }
      });
    });
  },

  notifyShopSubscribers(shopId: string, shop: Shop): void {
    const listeners = SHOP_LISTENERS.get(shopId);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn(shop);
        } catch (e) {
          console.error(e);
        }
      });
    }
  },

  async deleteShop(shopId: string): Promise<boolean> {
    if (!shopId) return false;
    try {
      await firestoreSync.deleteShop(shopId);

      // Persist to deleted shops list so it is never re-loaded
      try {
        const deletedRaw = localStorage.getItem('foodflow_deleted_shops');
        const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
        deletedSet.add(shopId);
        localStorage.setItem('foodflow_deleted_shops', JSON.stringify(Array.from(deletedSet)));
      } catch {}

      const stored = localStorage.getItem(SHOPS_STORAGE_KEY);
      if (stored) {
        const parsed: Shop[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((s) => s.id !== shopId && s.slug !== shopId);
          this.saveStoredShops(filtered);
        }
      }
      this.notifyShopSubscribers(shopId, null as any);
      this.notifyAllShopsListeners();
      return true;
    } catch (err) {
      console.error('[shopService] Failed to delete shop:', err);
      return false;
    }
  },

  async getNearbyShops(
    categoryId?: string,
    query?: string,
    userLocation?: { latitude: number; longitude: number },
    isRealUser?: boolean
  ): Promise<Shop[]> {
    // 0. Smart Listing Cache Lookup: return instant cached results if fresh
    const cacheKey = getListingCacheKey(undefined, `${categoryId || 'all'}:${query || ''}`, userLocation);
    const cachedListing = NEARBY_LISTING_CACHE.get(cacheKey);
    if (cachedListing && (Date.now() - cachedListing.timestamp < LISTING_CACHE_TTL_MS)) {
      return cachedListing.data;
    }

    let shops: Shop[] = [];
    const deletedRaw = typeof window !== 'undefined' ? localStorage.getItem('foodflow_deleted_shops') : null;
    const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);

    if (isSupabaseConfigured) {
      try {
        const remoteShops = await firestoreSync.getShops(isRealUser);
        shops = (remoteShops || []).filter(
          (s) =>
            !s.isDemo &&
            !MOCK_SHOP_IDS.has(s.id) &&
            !MOCK_SHOP_IDS.has(s.slug) &&
            !deletedSet.has(s.id) &&
            !isShopSuspendedOrKycPending(s)
        );
        // Sync localStorage with exact live database list (even if empty when all shops are deleted)
        this.saveStoredShops(shops);
      } catch {
        shops = [];
      }
    } else {
      shops = this.getStoredShops(isRealUser).filter(
        (s) => !s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id) && !isShopSuspendedOrKycPending(s)
      );
      if (shops.length === 0) {
        shops = MOCK_SHOPS.filter((s) => !deletedSet.has(s.id) && !isShopSuspendedOrKycPending(s));
      }
    }

    const loc = userLocation || DEFAULT_CUSTOMER_LOCATION;

    // Recalculate distance for each shop based on coordinates
    shops = shops.map((s) => {
      const shopLat = s.latitude || s.location?.latitude;
      const shopLng = s.longitude || s.location?.longitude;
      if (shopLat && shopLng && loc.latitude && loc.longitude) {
        const dist = calculateDistanceKm(loc.latitude, loc.longitude, shopLat, shopLng);
        return {
          ...s,
          location: {
            ...s.location,
            distanceKm: dist,
          },
        };
      }
      return s;
    });

    // Strictly filter out any suspended stalls
    shops = shops.filter((s) => !isShopSuspendedOrKycPending(s));

    // Sort by nearest distance first
    shops.sort((a, b) => (a.location?.distanceKm ?? 999) - (b.location?.distanceKm ?? 999));

    if (categoryId && categoryId !== 'all') {
      shops = shops.filter((s) => s.categories && s.categories.includes(categoryId));
    }

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      shops = shops.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.tagline && s.tagline.toLowerCase().includes(q)) ||
          (s.location?.address && s.location.address.toLowerCase().includes(q)) ||
          (s.categories && s.categories.some((c) => c.toLowerCase().includes(q)))
      );
    }

    // Warm smart listing cache
    NEARBY_LISTING_CACHE.set(cacheKey, { data: shops, timestamp: Date.now() });

    return shops;
  },

  async getShop(shopIdOrSlug: string, isRealUser?: boolean): Promise<Shop | null> {
    return this.getShopById(shopIdOrSlug, isRealUser);
  },

  async getShopById(shopIdOrSlug: string, isRealUser?: boolean): Promise<Shop | null> {
    await new Promise((r) => setTimeout(r, 10));

    if (!shopIdOrSlug) {
      return null;
    }
    const cleanId = decodeURIComponent(String(shopIdOrSlug))
      .toLowerCase()
      .trim()
      .replace(/^\/shop\//, '')
      .replace(/\/$/, '');

    if (!cleanId || cleanId === 'undefined' || cleanId === 'null' || cleanId === '[shopid]') {
      return null;
    }

    const deletedRaw = typeof window !== 'undefined' ? localStorage.getItem('foodflow_deleted_shops') : null;
    const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
    if (deletedSet.has(cleanId)) {
      return null;
    }

    // 0. Sub-50ms Cache Lookup: check if stall is cached and fresh (< 5 mins)
    const cachedEntry = STALL_DETAILS_CACHE.get(cleanId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < STALL_CACHE_TTL_MS) {
      if (!deletedSet.has(cachedEntry.data.id) && !isShopSuspendedOrKycPending(cachedEntry.data)) {
        return cachedEntry.data;
      }
    }

    // 1. If Supabase is configured, strictly use live database
    if (isSupabaseConfigured) {
      try {
        const remoteShop = await firestoreSync.getShop(cleanId);
        if (
          remoteShop &&
          !remoteShop.isDemo &&
          !MOCK_SHOP_IDS.has(remoteShop.id) &&
          !MOCK_SHOP_IDS.has(remoteShop.slug) &&
          !deletedSet.has(remoteShop.id) &&
          !isShopSuspendedOrKycPending(remoteShop)
        ) {
          // Warm cache
          STALL_DETAILS_CACHE.set(cleanId, { data: remoteShop, timestamp: Date.now() });
          if (remoteShop.id) STALL_DETAILS_CACHE.set(remoteShop.id.toLowerCase(), { data: remoteShop, timestamp: Date.now() });
          if (remoteShop.slug) STALL_DETAILS_CACHE.set(remoteShop.slug.toLowerCase(), { data: remoteShop, timestamp: Date.now() });
          return remoteShop;
        }
        return null;
      } catch (err) {
        console.warn('[shopService] Remote getShop error:', err);
        return null;
      }
    }

    // 2. Offline / non-Supabase fallback
    const shops = this.getStoredShops(isRealUser);
    const found = shops.find(
      (s) =>
        (s.id && s.id.toLowerCase() === cleanId) ||
        (s.slug && s.slug.toLowerCase() === cleanId) ||
        (s.name && s.name.toLowerCase() === cleanId)
    );
    if (found && !deletedSet.has(found.id) && !isShopSuspendedOrKycPending(found)) return found;

    return null;
  },

  async addShopReview(review: ShopReview): Promise<void> {
    IN_MEMORY_REVIEWS.unshift(review);
    let reviews: ShopReview[] = [];
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
        if (stored) reviews = JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    reviews = [review, ...reviews.filter((r) => r.orderId !== review.orderId)];
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
      }
    } catch {
      // fallback
    }

    // Recalculate average rating and total review count for this stall
    const shopReviews = reviews.filter((r) => r.shopId === review.shopId);
    if (shopReviews.length > 0) {
      const totalScore = shopReviews.reduce((sum, r) => sum + r.rating, 0);
      const avg = Number((totalScore / shopReviews.length).toFixed(1));
      await this.updateShop(review.shopId, {
        rating: avg,
        totalReviews: shopReviews.length,
      });
    }
  },

  getShopReviews(shopId: string): ShopReview[] {
    const memoryMatches = IN_MEMORY_REVIEWS.filter((r) => r.shopId === shopId);
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
        if (stored) {
          const reviews: ShopReview[] = JSON.parse(stored);
          const localMatches = reviews.filter((r) => r.shopId === shopId);
          const reviewMap = new Map<string, ShopReview>();
          localMatches.forEach((r) => reviewMap.set(r.id, r));
          memoryMatches.forEach((r) => reviewMap.set(r.id, r));
          return Array.from(reviewMap.values());
        }
      }
    } catch {
      // fallback
    }
    return memoryMatches;
  },

  async updateShop(shopId: string, updates: Partial<Shop>): Promise<Shop | null> {
    await new Promise((r) => setTimeout(r, 60));
    const cleanId = (shopId || '').toLowerCase().trim();
    const shops = this.getStoredShops();
    const idx = shops.findIndex(
      (s) =>
        (s.id && s.id.toLowerCase() === cleanId) ||
        (s.slug && s.slug.toLowerCase() === cleanId)
    );
    if (idx === -1) {
      // Also check real shops
      const realShops = this.getStoredShops(true);
      const realIdx = realShops.findIndex(
        (s) =>
          (s.id && s.id.toLowerCase() === cleanId) ||
          (s.slug && s.slug.toLowerCase() === cleanId)
      );
      if (realIdx !== -1) {
        const updated = { ...realShops[realIdx], ...updates };
        realShops[realIdx] = updated;
        this.saveStoredShops(realShops);
        return updated;
      }
      return null;
    }

    const updated = { ...shops[idx], ...updates };
    shops[idx] = updated;
    this.saveStoredShops(shops);

    const listeners = SHOP_LISTENERS.get(shopId);
    if (listeners) {
      listeners.forEach((fn) => fn(updated));
    }

    // Also sync updates to Firestore
    try {
      await firestoreSync.updateShop(shopId, updates);
    } catch {
      // fallback
    }

    return updated;
  },

  async updateShopStatus(shopId: string, isOpen: boolean): Promise<Shop | null> {
    return this.updateShop(shopId, { isOpen });
  },

  subscribeToShop(shopId: string, listener: (shop: Shop) => void): () => void {
    if (!SHOP_LISTENERS.has(shopId)) {
      SHOP_LISTENERS.set(shopId, new Set());
    }
    SHOP_LISTENERS.get(shopId)!.add(listener);

    return () => {
      const set = SHOP_LISTENERS.get(shopId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          SHOP_LISTENERS.delete(shopId);
        }
      }
    };
  },

  async searchShopsAndItems(query: string, isRealUser?: boolean): Promise<{ shops: Shop[]; items: MenuItem[] }> {
    await new Promise((r) => setTimeout(r, 80));
    const q = query.toLowerCase().trim();
    const isReal = this.isRealUserCheck(isRealUser);

    let shops = await this.getNearbyShops(undefined, undefined, undefined, isReal);

    if (!q) {
      return { shops: shops.slice(0, 4), items: [] };
    }

    const matchedShops = shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.stallType.toLowerCase().includes(q) ||
        (s.location?.landmark && s.location.landmark.toLowerCase().includes(q))
    );

    let poolItems: MenuItem[] = [];
    try {
      const stored = localStorage.getItem('foodflow_menu_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          poolItems = parsed;
        }
      }
    } catch {
      // fallback
    }

    const matchedItems = poolItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );

    return { shops: matchedShops, items: matchedItems };
  },

  async getCategories(): Promise<ShopCategory[]> {
    if (isSupabaseConfigured) {
      try {
        const remoteCats = await firestoreSync.getCategories();
        if (remoteCats && remoteCats.length > 0) return remoteCats;
      } catch (err) {
        console.warn('[shopService] Error fetching categories from Supabase:', err);
      }
    }
    return MOCK_CATEGORIES;
  },

  getSavedShopIds(): string[] {
    try {
      const stored = localStorage.getItem(SAVED_SHOPS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return [];
  },

  toggleSaveShop(shopId: string): boolean {
    const current = this.getSavedShopIds();
    let updated: string[];
    const exists = current.includes(shopId);
    if (exists) {
      updated = current.filter((id) => id !== shopId);
    } else {
      updated = [...current, shopId];
    }
    try {
      localStorage.setItem(SAVED_SHOPS_KEY, JSON.stringify(updated));
    } catch {
      // fallback
    }
    return !exists;
  },

  isShopSaved(shopId: string): boolean {
    return this.getSavedShopIds().includes(shopId);
  },

  async getSavedShops(): Promise<Shop[]> {
    const ids = this.getSavedShopIds();
    const allShops = await this.getNearbyShops();
    return allShops.filter((s) => ids.includes(s.id));
  },
};
