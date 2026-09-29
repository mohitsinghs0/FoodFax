import { Shop, ShopCategory, MenuItem, ShopReview } from '../types';
import { MOCK_CATEGORIES } from '../data/mockData';
import { firestoreSync, MOCK_SHOP_IDS, normalizeShopDoc } from './firestoreSyncService';
import { calculateDistanceKm, DEFAULT_CUSTOMER_LOCATION } from './geoService';
import { isSupabaseConfigured } from '../supabase';

// Storage keys for persistence
const SHOPS_STORAGE_KEY = 'foodflow_shops_list';
const SAVED_SHOPS_KEY = 'foodflow_saved_shops';
const REVIEWS_STORAGE_KEY = 'foodflow_shop_reviews';
const IN_MEMORY_REVIEWS: ShopReview[] = [];

const SHOP_LISTENERS = new Map<string, Set<(shop: Shop) => void>>();
const ALL_SHOPS_LISTENERS = new Set<(shops: Shop[]) => void>();

// Verified authentic registered stall seed for live users
export const INITIAL_REAL_SHOPS: Shop[] = [
  {
    id: 'shop-411159',
    slug: 'deepak-chinese-corner',
    name: 'Deepak Chinese Corner',
    stallType: 'Fast Food Counter',
    tagline: 'Wok tossed Hakka Noodles & Manchurian since 2012',
    description: 'Hot sizzling Chinese street wok delicacies cooked fresh to order at Station Road, Naigaon East.',
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=1200&q=80',
    latitude: 19.3515,
    longitude: 72.8525,
    location: {
      address: 'Shop No. 4, Station Road, Naigaon East',
      landmark: 'Near Railway Station Platform 1 Exit',
      distanceKm: 0.2,
      latitude: 19.3515,
      longitude: 72.8525,
    },
    isOpen: true,
    openingHours: '11:30 AM – 11:00 PM',
    rating: 4.8,
    totalReviews: 24,
    categories: ['fast-food', 'snacks'],
    preparationTimeMinutes: '7–12',
    isPureVeg: true,
    tableServiceAvailable: false,
    featuredItem: 'Veg Schezwan Fried Rice & Manchurian Combo',
    isDemo: false,
  },
];

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
      const stored = localStorage.getItem(SHOPS_STORAGE_KEY);
      if (stored) {
        const parsed: Shop[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, Shop>();
          // Custom / registered stalls from local storage (must have valid id and name, never demo, never deleted)
          parsed.forEach((s) => {
            if (s && s.id && s.name && !s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id) && !map.has(s.id)) {
              map.set(s.id, s);
            }
          });
          INITIAL_REAL_SHOPS.forEach((s) => {
            if (!s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id) && !map.has(s.id)) {
              map.set(s.id, s);
            }
          });
          return Array.from(map.values());
        }
      }
    } catch {
      // fallback
    }
    const map = new Map<string, Shop>();
    INITIAL_REAL_SHOPS.forEach((s) => {
      if (!s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id) && !map.has(s.id)) {
        map.set(s.id, s);
      }
    });
    return Array.from(map.values());
  },

  saveStoredShops(shops: Shop[]): void {
    try {
      localStorage.setItem(SHOPS_STORAGE_KEY, JSON.stringify(shops));
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
    let shops: Shop[] = [];
    const deletedRaw = typeof window !== 'undefined' ? localStorage.getItem('foodflow_deleted_shops') : null;
    const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);

    try {
      // Fetch shops from database
      const remoteShops = await firestoreSync.getShops(isRealUser);
      if (isSupabaseConfigured) {
        // If Supabase is configured, use strictly the remote live shops returned from database
        // If a stall is removed from database, it will also be removed from the UI dashboard
        shops = remoteShops.filter((s) => !s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id));
      } else {
        shops = this.getStoredShops(isRealUser).filter((s) => !s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id));
      }
    } catch {
      shops = this.getStoredShops(isRealUser).filter((s) => !s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id));
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
    if (deletedSet.has(cleanId) || MOCK_SHOP_IDS.has(cleanId)) {
      return null;
    }

    // 1. Try fetching from database if configured
    if (isSupabaseConfigured) {
      try {
        const remoteShop = await firestoreSync.getShop(cleanId);
        if (remoteShop && !remoteShop.isDemo && !MOCK_SHOP_IDS.has(remoteShop.id) && !deletedSet.has(remoteShop.id)) {
          return remoteShop;
        }
        // If Supabase is configured and not in database, stall was removed or does not exist
        return null;
      } catch {
        return null;
      }
    }

    // 2. Check local stored shops (custom registered shops and catalog)
    const shops = this.getStoredShops(isRealUser);
    const found = shops.find(
      (s) =>
        (s.id && s.id.toLowerCase() === cleanId) ||
        (s.slug && s.slug.toLowerCase() === cleanId) ||
        (s.name && s.name.toLowerCase() === cleanId)
    );
    if (found && !deletedSet.has(found.id) && !MOCK_SHOP_IDS.has(found.id)) return found;

    // 3. Match stripped alphanumeric characters
    const cleanAlpha = cleanId.replace(/[^a-z0-9]/g, '');
    const alphaFound = shops.find(
      (s) =>
        s.id.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha ||
        s.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha ||
        s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha
    );
    if (alphaFound && !deletedSet.has(alphaFound.id) && !MOCK_SHOP_IDS.has(alphaFound.id)) return alphaFound;

    // 4. Check INITIAL_REAL_SHOPS explicitly
    const realFound = INITIAL_REAL_SHOPS.find(
      (s) =>
        (s.id && s.id.toLowerCase() === cleanId) ||
        (s.slug && s.slug.toLowerCase() === cleanId) ||
        (s.name && s.name.toLowerCase() === cleanId)
    );
    if (realFound && !deletedSet.has(realFound.id) && !MOCK_SHOP_IDS.has(realFound.id)) return realFound;

    // If not found, return null so caller can handle accurately
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
