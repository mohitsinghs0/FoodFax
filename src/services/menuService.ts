import { MenuItem, ShopCategory } from '../types';
import { MOCK_MENU_ITEMS, MOCK_CATEGORIES } from '../data/mockData';
import { firestoreSync } from './firestoreSyncService';

const MENU_ITEMS_KEY = 'foodflow_menu_items';
const CATEGORIES_KEY = 'foodflow_categories';

const NAIGAON_STARTER_ITEMS: MenuItem[] = [
  {
    id: 'item-ng-01',
    shopId: 'shop-411159',
    categoryId: 'fast-food',
    name: 'Special Veg Hakka Noodles',
    description: 'Wok-tossed thin noodles with crunchy julienned cabbage, carrots, bell peppers, and scallions in light soya.',
    price: 80,
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    isVeg: true,
    preparationTimeMin: 8,
    preparationMinutes: '5–8',
  },
  {
    id: 'item-ng-02',
    shopId: 'shop-411159',
    categoryId: 'fast-food',
    name: 'Veg Manchurian Dry',
    description: 'Crispy vegetable dumplings tossed with ginger, garlic, green chillies, spring onions, and dark soy glaze.',
    price: 90,
    image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    isVeg: true,
    preparationTimeMin: 10,
    preparationMinutes: '6–10',
  },
  {
    id: 'item-ng-03',
    shopId: 'shop-411159',
    categoryId: 'fast-food',
    name: 'Triple Schezwan Fried Rice',
    description: 'Aromatic basmati rice tossed with fiery house-made Schezwan sauce, fried noodles, and savoury gravy bowl.',
    price: 110,
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    isVeg: true,
    preparationTimeMin: 12,
    preparationMinutes: '7–12',
  },
  {
    id: 'item-ng-04',
    shopId: 'shop-411159',
    categoryId: 'snacks',
    name: 'Crispy Chinese Bhel',
    description: 'Street-style fried noodles tossed with shredded cabbage, onions, capsicum, and spicy tangy schezwan chutney.',
    price: 60,
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    isVeg: true,
    preparationTimeMin: 5,
    preparationMinutes: '3–5',
  },
  {
    id: 'item-ng-05',
    shopId: 'shop-411159',
    categoryId: 'fast-food',
    name: 'Paneer Chilli Dry',
    description: 'Fresh soft cottage cheese cubes wok-fried with diced bell peppers, red onions, garlic, and hot chilli sauce.',
    price: 120,
    image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    isVeg: true,
    preparationTimeMin: 12,
    preparationMinutes: '8–12',
  },
  {
    id: 'item-ng-06',
    shopId: 'shop-411159',
    categoryId: 'snacks',
    name: 'Steamed Veg Momos (6 Pcs)',
    description: 'Delicate steamed dumplings stuffed with finely minced vegetables, served with authentic spicy red chutney.',
    price: 70,
    image: 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    isVeg: true,
    preparationTimeMin: 8,
    preparationMinutes: '5–8',
  },
];

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
    return [...MOCK_MENU_ITEMS, ...NAIGAON_STARTER_ITEMS];
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

  async getShopMenu(shopId: string): Promise<MenuItem[]> {
    await new Promise((r) => setTimeout(r, 40));

    // 1. Try fetching from Firestore first
    try {
      const remoteItems = await firestoreSync.getMenuItemsByShop(shopId);
      if (remoteItems && remoteItems.length > 0) {
        return remoteItems;
      }
    } catch {
      // fallback
    }

    // 2. Check local store
    const items = this.getStoredItems();
    const matched = items.filter((item) => item.shopId === shopId);
    if (matched.length > 0) {
      return matched;
    }

    // 3. If shop-411159 or registered Deepak Chinese Corner stall, inject starter items
    const lowerId = shopId.toLowerCase();
    if (
      shopId === 'shop-411159' ||
      lowerId.includes('deepak') ||
      lowerId.includes('chinese') ||
      lowerId.includes('chainees')
    ) {
      const itemsForShop = NAIGAON_STARTER_ITEMS.map((item) => ({
        ...item,
        shopId: shopId,
      }));
      const updated = [...items, ...itemsForShop];
      this.saveStoredItems(updated);
      return itemsForShop;
    }

    return [];
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

  async getMenuItems(shopId?: string): Promise<MenuItem[]> {
    if (!shopId) {
      return this.getStoredItems();
    }
    return this.getShopMenu(shopId);
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

