import { MenuItem, ShopCategory } from '../types';
import { MOCK_MENU_ITEMS, MOCK_CATEGORIES } from '../data/mockData';
import { firestoreSync, isFakeOrDefaultMenuItem } from './firestoreSyncService';
import { isSupabaseConfigured } from '../supabase';

const MENU_ITEMS_KEY = 'foodflow_menu_items';
const CATEGORIES_KEY = 'foodflow_categories';

// Sub-50ms API Caching (5-minute TTL) for stall menus
export const MENU_CACHE_TTL_MS = 5 * 60 * 1000;
interface MenuCacheEntry {
  data: MenuItem[];
  timestamp: number;
}
const MENU_ITEMS_CACHE = new Map<string, MenuCacheEntry>();

export function clearMenuCache(shopId?: string): void {
  if (shopId) {
    MENU_ITEMS_CACHE.delete(shopId.toLowerCase());
  } else {
    MENU_ITEMS_CACHE.clear();
  }
}

export const menuService = {
  getStoredItems(): MenuItem[] {
    try {
      const stored = localStorage.getItem(MENU_ITEMS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return isSupabaseConfigured
            ? parsed.filter((i) => !isFakeOrDefaultMenuItem(i))
            : parsed;
        }
      }
    } catch {
      // fallback
    }
    return [];
  },

  saveStoredItems(items: MenuItem[]): void {
    try {
      const clean = isSupabaseConfigured
        ? items.filter((i) => !isFakeOrDefaultMenuItem(i))
        : items;
      localStorage.setItem(MENU_ITEMS_KEY, JSON.stringify(clean));
    } catch {
      // fallback
    }
  },

  getStoredCategories(): ShopCategory[] {
    try {
      const stored = localStorage.getItem(CATEGORIES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return MOCK_CATEGORIES;
  },

  saveStoredCategories(cats: ShopCategory[]): void {
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    } catch {
      // fallback
    }
  },

  async getShopMenu(shopId: string, shopSlug?: string): Promise<MenuItem[]> {
    const cacheKey = (shopId || shopSlug || '').toLowerCase().trim();
    if (cacheKey) {
      const cached = MENU_ITEMS_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < MENU_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 1. Fetch from Supabase / live sync
    try {
      const remoteItems = await firestoreSync.getMenuItemsByShop(shopId, shopSlug);
      if (remoteItems && remoteItems.length > 0) {
        if (cacheKey) {
          MENU_ITEMS_CACHE.set(cacheKey, { data: remoteItems, timestamp: Date.now() });
          if (shopId) MENU_ITEMS_CACHE.set(shopId.toLowerCase().trim(), { data: remoteItems, timestamp: Date.now() });
          if (shopSlug) MENU_ITEMS_CACHE.set(shopSlug.toLowerCase().trim(), { data: remoteItems, timestamp: Date.now() });
        }
        return remoteItems;
      }
    } catch (err) {
      console.warn('[menuService] Error fetching remote items:', err);
    }

    // 2. Check local store for any items added for this shop
    const items = this.getStoredItems();
    const lowerId = (shopId || '').toLowerCase().trim();
    const lowerSlug = (shopSlug || '').toLowerCase().trim();
    const idAlpha = lowerId.replace(/[^a-z0-9]/g, '');
    const slugAlpha = lowerSlug.replace(/[^a-z0-9]/g, '');

    let localShops: any[] = [];
    try {
      const raw = localStorage.getItem('foodflow_shops') || localStorage.getItem('foodflow_shops_list');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localShops = parsed;
      }
    } catch {}

    const foundShop = localShops.find(
      (s: any) =>
        (s.id && s.id.toLowerCase() === lowerId) ||
        (s.slug && s.slug.toLowerCase() === lowerId) ||
        (lowerSlug && s.id && s.id.toLowerCase() === lowerSlug) ||
        (lowerSlug && s.slug && s.slug.toLowerCase() === lowerSlug)
    );
    const resolvedId = foundShop?.id ? foundShop.id.toLowerCase().trim() : lowerId;
    const resolvedSlug = foundShop?.slug ? foundShop.slug.toLowerCase().trim() : lowerSlug;
    const resolvedIdAlpha = resolvedId.replace(/[^a-z0-9]/g, '');
    const resolvedSlugAlpha = resolvedSlug.replace(/[^a-z0-9]/g, '');

    const matched = items.filter((item) => {
      const sid = (item.shopId || '').toLowerCase().trim();
      const sidAlpha = sid.replace(/[^a-z0-9]/g, '');
      if (sid === lowerId || (lowerSlug && sid === lowerSlug)) return true;
      if (resolvedId && sid === resolvedId) return true;
      if (resolvedSlug && sid === resolvedSlug) return true;
      if (idAlpha && sidAlpha === idAlpha) return true;
      if (slugAlpha && sidAlpha === slugAlpha) return true;
      if (resolvedIdAlpha && sidAlpha === resolvedIdAlpha) return true;
      if (resolvedSlugAlpha && sidAlpha === resolvedSlugAlpha) return true;
      return false;
    });

    // If local store has items that were added by the owner, return them
    return matched;
  },

  async getItems(shopId: string): Promise<MenuItem[]> {
    return this.getShopMenu(shopId);
  },

  async getMenuItem(itemId: string): Promise<MenuItem | null> {
    await new Promise((r) => setTimeout(r, 30));
    const items = this.getStoredItems();
    return items.find((item) => item.id === itemId) || null;
  },

  async createItem(itemData: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    await new Promise((r) => setTimeout(r, 60));
    const items = this.getStoredItems();
    const newItem: MenuItem = {
      ...itemData,
      id: `item-${Date.now().toString().slice(-5)}`,
    };
    const updated = [newItem, ...items];
    this.saveStoredItems(updated);
    try {
      await firestoreSync.createMenuItem(newItem);
    } catch {
      // fallback
    }
    return newItem;
  },

  async updateItem(itemId: string, updates: Partial<MenuItem>): Promise<MenuItem | null> {
    await new Promise((r) => setTimeout(r, 50));
    const items = this.getStoredItems();
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) return null;

    const updatedItem = { ...items[index], ...updates };
    items[index] = updatedItem;
    this.saveStoredItems(items);
    try {
      await firestoreSync.updateMenuItem(itemId, updates);
    } catch {
      // fallback
    }
    return updatedItem;
  },

  async updateItemAvailability(itemId: string, isAvailable: boolean): Promise<MenuItem | null> {
    return this.updateItem(itemId, { isAvailable });
  },

  async deleteItem(itemId: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 50));
    const items = this.getStoredItems();
    const filtered = items.filter((i) => i.id !== itemId);
    this.saveStoredItems(filtered);
    try {
      await firestoreSync.deleteMenuItem(itemId);
    } catch {
      // fallback
    }
    return true;
  },

  async getCategories(shopId?: string): Promise<ShopCategory[]> {
    await new Promise((r) => setTimeout(r, 30));
    if (isSupabaseConfigured) {
      try {
        const remote = await firestoreSync.getCategories();
        if (remote && remote.length > 0) return remote;
      } catch {}
    }
    return this.getStoredCategories();
  },

  async createCategory(shopId: string, category: { name: string; iconName?: string; description?: string }): Promise<ShopCategory> {
    const cats = this.getStoredCategories();
    const id = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newCat: ShopCategory = {
      id,
      name: category.name,
      iconName: category.iconName || 'Utensils',
      description: category.description || '',
    };
    const updated = [...cats, newCat];
    this.saveStoredCategories(updated);
    return newCat;
  },

  async updateCategory(shopId: string, categoryId: string, updates: Partial<ShopCategory>): Promise<ShopCategory | null> {
    const cats = this.getStoredCategories();
    const idx = cats.findIndex((c) => c.id === categoryId);
    if (idx === -1) return null;
    cats[idx] = { ...cats[idx], ...updates };
    this.saveStoredCategories(cats);
    return cats[idx];
  },

  async deleteCategory(shopId: string, categoryId: string): Promise<boolean> {
    const cats = this.getStoredCategories();
    const filtered = cats.filter((c) => c.id !== categoryId);
    this.saveStoredCategories(filtered);
    return true;
  },

  async getShopCategoriesWithItems(shopId: string): Promise<{ categoryId: string; items: MenuItem[] }[]> {
    const items = await this.getShopMenu(shopId);
    const categoryMap = new Map<string, MenuItem[]>();

    items.forEach((item) => {
      const current = categoryMap.get(item.categoryId) || [];
      categoryMap.set(item.categoryId, [...current, item]);
    });

    const result: { categoryId: string; items: MenuItem[] }[] = [];
    categoryMap.forEach((catItems, categoryId) => {
      result.push({ categoryId, items: catItems });
    });

    return result;
  },

  async getMenuItems(shopId?: string, shopSlug?: string): Promise<MenuItem[]> {
    if (!shopId) {
      return this.getStoredItems();
    }
    return this.getShopMenu(shopId, shopSlug);
  },

  async toggleAvailability(itemId: string, isAvailable: boolean): Promise<MenuItem | null> {
    return this.updateItem(itemId, { isAvailable });
  },

  async addMenuItem(itemData: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    return this.createItem(itemData);
  },

  async updateMenuItem(itemId: string, updates: Partial<MenuItem>): Promise<MenuItem | null> {
    return this.updateItem(itemId, updates);
  },

  async deleteMenuItem(itemId: string): Promise<boolean> {
    return this.deleteItem(itemId);
  },
};

