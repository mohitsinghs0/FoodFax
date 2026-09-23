import { Shop, ShopCategory, MenuItem } from '../types';
import { MOCK_SHOPS, MOCK_CATEGORIES, MOCK_MENU_ITEMS } from '../data/mockData';
import { firestoreSync, MOCK_SHOP_IDS, normalizeShopDoc } from './firestoreSyncService';
import { calculateDistanceKm, DEFAULT_CUSTOMER_LOCATION } from './geoService';

// Storage keys for persistence
const SHOPS_STORAGE_KEY = 'foodflow_shops_list';
const SAVED_SHOPS_KEY = 'foodflow_saved_shops';

const SHOP_LISTENERS = new Map<string, Set<(shop: Shop) => void>>();

export const shopService = {
  isRealUserCheck(override?: boolean): boolean {
    if (override !== undefined) return override;
    try {
      const stored = localStorage.getItem('foodflow_auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.isDemo || u.id === 'demo-customer-001' || u.id === 'demo-owner-001') {
          return false;
        }
        return true;
      }
    } catch {
      // fallback
    }
    return true; // Default to real mode
  },

  getStoredShops(isRealUser?: boolean): Shop[] {
    const isReal = this.isRealUserCheck(isRealUser);
    try {
      const stored = localStorage.getItem(SHOPS_STORAGE_KEY);
      if (stored) {
        const parsed: Shop[] = JSON.parse(stored);
        if (isReal) {
          return parsed.filter((s) => !s.isDemo && !MOCK_SHOP_IDS.has(s.id));
        }
        return parsed;
      }
    } catch {
      // fallback
    }
    return isReal ? [] : MOCK_SHOPS;
  },

  saveStoredShops(shops: Shop[]): void {
    try {
      localStorage.setItem(SHOPS_STORAGE_KEY, JSON.stringify(shops));
    } catch {
      // fallback
    }
  },

  async getNearbyShops(
    categoryId?: string,
    query?: string,
    userLocation?: { latitude: number; longitude: number },
    isRealUser?: boolean
  ): Promise<Shop[]> {
    const isReal = this.isRealUserCheck(isRealUser);
    let shops: Shop[] = [];

    try {
      // Fetch shops from Firestore (real shops)
      const remoteShops = await firestoreSync.getShops(isReal);
      if (remoteShops && remoteShops.length > 0) {
        shops = remoteShops;
      } else {
        shops = this.getStoredShops(isReal);
      }
    } catch {
      shops = this.getStoredShops(isReal);
    }

    if (isReal) {
      // In Real User Mode: Merge with any locally saved non-demo shops
      const localRealShops = this.getStoredShops(true);
      const shopMap = new Map<string, Shop>();
      localRealShops.forEach((s) => shopMap.set(s.id, s));
      shops.forEach((s) => shopMap.set(s.id, s));

      // Strictly purge any demo shops
      shops = Array.from(shopMap.values()).filter(
        (s) => !s.isDemo && !MOCK_SHOP_IDS.has(s.id)
      );

      // If no real shops exist in the database, return empty array (do NOT show demo shops!)
      if (shops.length === 0) {
        return [];
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

  async getShop(shopIdOrSlug: string): Promise<Shop | null> {
    return this.getShopById(shopIdOrSlug);
  },

  async getShopById(shopIdOrSlug: string): Promise<Shop | null> {
    await new Promise((r) => setTimeout(r, 40));
    const cleanId = shopIdOrSlug.toLowerCase().trim();

    // 1. Try fetching from Firestore directly (for real registered shops like shop-411159)
    try {
      const remoteShop = await firestoreSync.getShop(cleanId);
      if (remoteShop) return remoteShop;
    } catch {
      // fallback
    }

    // 2. Check local store
    const shops = this.getStoredShops();
    const found = shops.find(
      (s) => s.id.toLowerCase() === cleanId || s.slug.toLowerCase() === cleanId
    );
    if (found) return found;

    // 3. Fallback to mock shops only if it matches mock shop IDs
    if (MOCK_SHOP_IDS.has(cleanId)) {
      const mockFound = MOCK_SHOPS.find(
        (s) => s.id.toLowerCase() === cleanId || s.slug.toLowerCase() === cleanId
      );
      if (mockFound) return mockFound;
    }

    return null;
  },

  async updateShop(shopId: string, updates: Partial<Shop>): Promise<Shop | null> {
    await new Promise((r) => setTimeout(r, 60));
    const shops = this.getStoredShops();
    const idx = shops.findIndex((s) => s.id === shopId || s.slug === shopId);
    if (idx === -1) return null;

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

    const poolItems = isReal ? [] : MOCK_MENU_ITEMS;
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
    const isReal = this.isRealUserCheck();
    return isReal ? [] : ['sharma-vada-pav', 'college-canteen'];
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
