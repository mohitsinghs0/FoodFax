import { MenuItem, ShopCategory } from '../types';
import { MOCK_MENU_ITEMS, MOCK_CATEGORIES } from '../data/mockData';
import { firestoreSync, MOCK_SHOP_IDS } from './firestoreSyncService';

const MENU_ITEMS_KEY = 'foodflow_menu_items';
const CATEGORIES_KEY = 'foodflow_categories';



export const menuService = {
  getStoredItems(): MenuItem[] {
    try {
      const stored = localStorage.getItem(MENU_ITEMS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return [...MOCK_MENU_ITEMS];
  },

  saveStoredItems(items: MenuItem[]): void {
    try {
      localStorage.setItem(MENU_ITEMS_KEY, JSON.stringify(items));
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
    await new Promise((r) => setTimeout(r, 20));

    // 1. Try fetching from Supabase first with timeout protection
    try {
      const remoteItems = await firestoreSync.getMenuItemsByShop(shopId, shopSlug);
      if (remoteItems && remoteItems.length > 0) {
        // Optimistically cache items in local store so future loads are instantaneous
        try {
          const currentStored = this.getStoredItems();
          const mergedMap = new Map<string, MenuItem>();
          currentStored.forEach((i) => mergedMap.set(i.id, i));
          remoteItems.forEach((i) => mergedMap.set(i.id, i));
          this.saveStoredItems(Array.from(mergedMap.values()));
        } catch {}
        return remoteItems;
      }
    } catch {
      // fallback
    }

    // 2. Check local store
    const items = this.getStoredItems();
    const lowerId = (shopId || '').toLowerCase().trim();
    const lowerSlug = (shopSlug || '').toLowerCase().trim();
    const matched = items.filter((item) => {
      const sid = (item.shopId || '').toLowerCase().trim();
      return sid === lowerId || (lowerSlug && sid === lowerSlug);
    });
    if (matched.length > 0) {
      return matched;
    }

    // 3. Resilient fallback to stall menu generator
    return firestoreSync.getMenuItems(shopId, shopSlug);
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

