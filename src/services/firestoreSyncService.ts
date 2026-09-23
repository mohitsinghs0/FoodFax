/**
 * supabaseSyncService (legacy name: firestoreSyncService)
 *
 * This is the core data-access layer for FoodFax. Despite the filename,
 * this service uses **Supabase (PostgreSQL + Realtime)** — NOT Firebase Firestore.
 * The "firestore" name is a historical artifact from an earlier migration.
 *
 * Responsibilities:
 *  - Database CRUD via supabase-js client
 *  - Supabase Realtime WebSocket subscriptions (postgres_changes)
 *  - Mock data fallback when offline / during demo mode
 *  - Order commit event broadcasting
 */
import { supabase } from '../supabase';
import { 
  Order, 
  OrderItem, 
  Shop, 
  MenuItem, 
  ShopCategory, 
  DatabaseUser, 
  OrderStatusHistory, 
  PaymentRecord, 
  FavoriteShopRecord, 
  TokenCounterRecord,
  OrderStatus,
  PaymentStatus,
  BusinessNotification
} from '../types';
import { MOCK_SHOPS, MOCK_MENU_ITEMS, MOCK_CATEGORIES, INITIAL_ORDERS } from '../data/mockData';
import { assertValidOrderSubmission } from '../utils/orderValidation';


type SyncListener = (isSyncing: boolean) => void;

export type OrderCommitListener = (order: Order) => void;
const ORDER_COMMIT_LISTENERS = new Set<OrderCommitListener>();

export const onDatabaseOrderCommitted = (listener: OrderCommitListener): (() => void) => {
  ORDER_COMMIT_LISTENERS.add(listener);
  return () => {
    ORDER_COMMIT_LISTENERS.delete(listener);
  };
};

export const notifyDatabaseOrderCommitted = (order: Order): void => {
  ORDER_COMMIT_LISTENERS.forEach((listener) => {
    try {
      listener(order);
    } catch (err) {
      console.error('[SupabaseSync] Error in order commit listener:', err);
    }
  });
};

export const MOCK_SHOP_IDS = new Set<string>([
  'sharma-vada-pav',
  'college-canteen',
  'mumbai-snacks-corner',
  'tapri-tea-house',
  'sandwich-station',
  'fresh-juice-point',
  'punjabi-kulcha-point',
  'pune-vada-pav',
  'delhi-chaat-hub',
  'ahmedabad-farsan-stall',
  'bengaluru-filter-coffee',
]);

/**
 * Normalizes a database row or legacy document into standard frontend Shop interface.
 */
export function normalizeShopDoc(data: any): Shop {
  if (!data) {
    return MOCK_SHOPS[0];
  }

  const shopId = data.id || 'shop-registered';
  let rawName = (data.name || data.shopName || data.businessName || '').trim();
  const lowerAll = JSON.stringify(data).toLowerCase();

  const isDeepak =
    shopId === 'deepak-chinese-corner' ||
    shopId === 'shop-411159' ||
    lowerAll.includes('deepak') ||
    lowerAll.includes('chinese') ||
    data.contact_phone === '+91 9321444296' ||
    data.contactPhone === '+91 9321444296' ||
    data.phone === '+91 9321444296';

  let name = rawName;
  if (!name || isDeepak) {
    if (isDeepak) {
      name = 'Deepak Chinese Corner';
    } else if (data.description) {
      name = data.description.split('.')[0].trim();
      name = name.charAt(0).toUpperCase() + name.slice(1);
    } else {
      name = 'Registered Food Stall';
    }
  }

  const desc = data.description || data.tagline || (isDeepak ? 'Special Veg Hakka Noodles, Manchurian & Schezwan fast food counter' : 'Fresh street food made to order');
  const area = data.area || (isDeepak ? 'Naigaon East' : 'Andheri West');
  const city = data.city || 'Mumbai Suburban';
  const address = data.address || data.location?.address || (isDeepak ? 'Shop No. 4, Station Road, Naigaon East, Mumbai' : 'Street Counter');
  
  let lat = Number(data.latitude || data.location?.latitude || (isDeepak ? 19.3515 : 19.1197));
  let lng = Number(data.longitude || data.location?.longitude || (isDeepak ? 72.8525 : 72.8464));

  if (!lat || isNaN(lat)) lat = isDeepak ? 19.3515 : 19.1197;
  if (!lng || isNaN(lng)) lng = isDeepak ? 72.8525 : 72.8464;

  const image =
    data.image ||
    data.banner_image ||
    data.bannerImage ||
    (isDeepak
      ? 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80'
      : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80');

  return {
    ...data,
    id: shopId,
    slug: data.slug || (isDeepak ? 'deepak-chinese-corner' : shopId),
    name,
    stallType: data.stall_type || data.stallType || 'Thela / Food Stall',
    tagline: data.tagline || (isDeepak ? 'Authentic Wok Noodles, Crispy Manchurian & Schezwan' : desc),
    description: desc,
    image,
    bannerImage: data.banner_image || data.bannerImage || image,
    latitude: lat,
    longitude: lng,
    phone: data.phone || data.contact_phone || data.contactPhone || '+91 98200 12345',
    contactPhone: data.contact_phone || data.contactPhone || data.phone || '+91 98200 12345',
    address,
    area,
    city,
    location: {
      address,
      landmark: data.location?.landmark || `${area}, ${city}`,
      distanceKm: Number(data.location?.distanceKm ?? data.distance_km ?? 0.5),
      latitude: lat,
      longitude: lng,
    },
    isOpen: data.is_open !== false && data.isOpen !== false,
    openingTime: data.opening_time || data.openingTime || '11:00 AM',
    closingTime: data.closing_time || data.closingTime || '11:00 PM',
    openingHours: data.opening_hours || data.openingHours || `${data.opening_time || data.openingTime || '11:00 AM'} – ${data.closing_time || data.closingTime || '11:00 PM'}`,
    rating: Number(data.rating) || 4.8,
    totalReviews: Number(data.total_reviews ?? data.totalReviews ?? 18),
    categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : ['fast-food', 'snacks'],
    preparationTimeMinutes: data.preparation_time_minutes || data.preparationTimeMinutes || '5–10',
    isPureVeg: data.is_pure_veg !== undefined ? Boolean(data.is_pure_veg) : (data.isPureVeg !== undefined ? Boolean(data.isPureVeg) : true),
    tableServiceAvailable: Boolean(data.table_service_available ?? data.tableServiceAvailable),
    featuredItem: data.featured_item || data.featuredItem || (isDeepak ? 'Special Veg Hakka Noodles' : `${name} Signature`),
    isDemo: Boolean(data.is_demo ?? data.isDemo),
  };
}

/**
 * Normalizes a database row into standard frontend Order interface.
 */
export function normalizeOrderDoc(data: any): Order {
  return {
    id: data.id,
    shopId: data.shop_id || data.shopId,
    shopName: data.shop_name || data.shopName || 'Food Stall',
    shopImage: data.shop_image || data.shopImage,
    shopLocation: data.shop_location || data.shopLocation || '',
    customerId: data.customer_id || data.customerId || '',
    customerName: data.customer_name || data.customerName || 'Customer',
    customerPhone: data.customer_phone || data.customerPhone || '',
    tokenNumber: data.token_number || data.tokenNumber || '#101',
    orderType: data.order_type || data.orderType || 'TAKEAWAY',
    tableNumber: data.table_number || data.tableNumber,
    paymentMethod: data.payment_method || data.paymentMethod || 'CASH_AT_COUNTER',
    paymentMode: data.payment_mode || data.paymentMode || data.payment_method || 'CASH_AT_COUNTER',
    paymentStatus: data.payment_status || data.paymentStatus || 'PENDING',
    orderStatus: data.order_status || data.orderStatus || 'PENDING',
    items: Array.isArray(data.items) ? data.items : [],
    subtotal: Number(data.subtotal || 0),
    total: Number(data.total || 0),
    estimatedPreparationMinutes: data.estimated_preparation_minutes || data.estimatedPreparationMinutes || '5-10',
    createdAt: data.created_at || data.createdAt || new Date().toISOString(),
    updatedAt: data.updated_at || data.updatedAt,
    readyAt: data.ready_at || data.readyAt,
    completedAt: data.completed_at || data.completedAt,
    instructions: data.instructions,
    cancellationReason: data.cancellation_reason || data.cancellationReason,
    cancelledAt: data.cancelled_at || data.cancelledAt,
    cancelledBy: data.cancelled_by || data.cancelledBy,
    rating: data.rating ? Number(data.rating) : undefined,
    reviewText: data.review_text || data.reviewText,
    reviewedAt: data.reviewed_at || data.reviewedAt,
    feedbackTags: Array.isArray(data.feedback_tags || data.feedbackTags) ? (data.feedback_tags || data.feedbackTags) : [],
    isDemo: Boolean(data.is_demo ?? data.isDemo),
  };
}

/**
 * Normalizes a database row into standard MenuItem interface.
 */
export function normalizeMenuItemDoc(data: any): MenuItem {
  return {
    id: data.id,
    shopId: data.shop_id || data.shopId,
    categoryId: data.category_id || data.categoryId || 'cat-1',
    name: data.name,
    description: data.description || '',
    price: Number(data.price || 0),
    image: data.image || '',
    isAvailable: data.is_available !== false && data.isAvailable !== false,
    isVeg: data.is_veg !== false && data.isVeg !== false,
    isBestseller: Boolean(data.is_bestseller || data.isBestseller),
    preparationTimeMin: Number(data.preparation_time_min ?? data.preparationTimeMin ?? 5),
    preparationMinutes: data.preparation_minutes || data.preparationMinutes || '5-10',
    customizationOptions: data.customization_options || data.customizationOptions || [],
  };
}

class SupabaseSyncService {
  private isInitialized = false;
  private activeSyncCount = 0;
  private syncListeners = new Set<SyncListener>();

  public subscribeSyncState(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    listener(this.activeSyncCount > 0);
    return () => this.syncListeners.delete(listener);
  }

  private startSync() {
    this.activeSyncCount++;
    this.notifySync(true);
  }

  private endSync() {
    this.activeSyncCount = Math.max(0, this.activeSyncCount - 1);
    if (this.activeSyncCount === 0) {
      this.notifySync(false);
    }
  }

  private notifySync(isSyncing: boolean) {
    this.syncListeners.forEach((fn) => fn(isSyncing));
  }

  // ============================================================
  // DATABASE INITIALIZATION & SEED
  // ============================================================

  public async initializeDatabase(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.startSync();

    try {
      // Check if categories table is reachable and has data
      const { data: existingCats, error } = await supabase
        .from('categories')
        .select('id')
        .limit(1);

      if (!error && (!existingCats || existingCats.length === 0)) {
        // Seed categories in Supabase
        for (const cat of MOCK_CATEGORIES) {
          await supabase.from('categories').upsert({
            id: cat.id,
            name: cat.name,
            icon_name: cat.iconName,
            description: cat.description,
            is_active: true,
          });
        }
      }
    } catch (err) {
      console.warn('[Supabase] Initialization note:', err);
    } finally {
      this.endSync();
    }
  }

  // ============================================================
  // 1. USERS CRUD
  // ============================================================

  public async createUser(user: DatabaseUser): Promise<void> {
    this.startSync();
    try {
      await supabase.from('users').upsert({
        id: user.id,
        phone: user.phone,
        email: user.email,
        full_name: user.fullName || user.name,
        role: user.role,
        shop_id: user.shopId,
        latitude: user.latitude,
        longitude: user.longitude,
        area: user.area,
        city: user.city,
        photo_url: user.photoUrl,
        profile_completed: user.profileCompleted ?? false,
        is_active: user.isActive !== false,
        created_at: user.createdAt,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Supabase] Error creating user:', err);
    } finally {
      this.endSync();
    }
  }

  public async getUser(userId: string): Promise<DatabaseUser | null> {
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        phone: data.phone || '',
        email: data.email,
        fullName: data.full_name,
        name: data.full_name,
        role: data.role,
        shopId: data.shop_id,
        latitude: data.latitude,
        longitude: data.longitude,
        area: data.area,
        city: data.city,
        photoUrl: data.photo_url,
        profileCompleted: data.profile_completed,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.warn('[Supabase] Error getting user:', err);
      return null;
    } finally {
      this.endSync();
    }
  }

  public async updateUser(userId: string, updates: Partial<DatabaseUser>): Promise<void> {
    this.startSync();
    try {
      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.name !== undefined) dbUpdates.full_name = updates.name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;
      if (updates.profileCompleted !== undefined) dbUpdates.profile_completed = updates.profileCompleted;
      if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
      if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
      if (updates.area !== undefined) dbUpdates.area = updates.area;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

      await supabase.from('users').update(dbUpdates).eq('id', userId);
    } catch (err) {
      console.warn('[Supabase] Error updating user:', err);
    } finally {
      this.endSync();
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    await this.updateUser(userId, { isActive: false });
  }

  // ============================================================
  // 2. SHOPS CRUD
  // ============================================================

  public async createShop(shop: Shop): Promise<void> {
    this.startSync();
    try {
      const dbShop = {
        id: shop.id,
        owner_id: shop.ownerId,
        name: shop.name,
        slug: shop.slug || shop.id,
        stall_type: shop.stallType,
        tagline: shop.tagline,
        description: shop.description,
        image: shop.image,
        banner_image: shop.bannerImage || shop.image,
        phone: shop.phone || shop.contactPhone,
        contact_phone: shop.contactPhone || shop.phone,
        address: shop.address || shop.location?.address,
        area: shop.area,
        city: shop.city,
        state: shop.state,
        pincode: shop.pincode,
        latitude: shop.latitude || shop.location?.latitude,
        longitude: shop.longitude || shop.location?.longitude,
        upi_id: shop.upiId,
        opening_time: shop.openingTime,
        closing_time: shop.closingTime,
        opening_hours: shop.openingHours,
        is_open: shop.isOpen,
        is_pure_veg: shop.isPureVeg,
        rating: shop.rating,
        total_reviews: shop.totalReviews,
        preparation_time_minutes: shop.preparationTimeMinutes,
        featured_item: shop.featuredItem,
        is_rush_hour: shop.isRushHour,
        table_service_available: shop.tableServiceAvailable,
        categories: shop.categories,
        is_demo: shop.isDemo || false,
        updated_at: new Date().toISOString(),
      };

      await supabase.from('shops').upsert(dbShop);
    } catch (err) {
      console.warn('[Supabase] Error creating shop:', err);
    } finally {
      this.endSync();
    }
  }

  public async saveShop(shop: Shop): Promise<void> {
    return this.createShop(shop);
  }

  public async getShop(shopId: string): Promise<Shop | null> {
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .maybeSingle();

      if (error || !data) return null;
      return normalizeShopDoc(data);
    } catch (err) {
      console.warn('[Supabase] Error getting shop:', err);
      return null;
    } finally {
      this.endSync();
    }
  }

  public async getShops(isRealUser?: boolean): Promise<Shop[]> {
    this.startSync();
    try {
      const rawShopsMap = new Map<string, Shop>();

      // Fetch from Supabase shops table
      const { data: remoteShops, error } = await supabase
        .from('shops')
        .select('*');

      if (!error && remoteShops && remoteShops.length > 0) {
        remoteShops.forEach((d) => {
          const normalized = normalizeShopDoc(d);
          rawShopsMap.set(normalized.id, normalized);
        });
      }

      // In real user mode, return remote shops if present, or all registered shops
      if (rawShopsMap.size > 0) {
        return Array.from(rawShopsMap.values());
      }

      // Fallback to initial mock shops for demo/offline simulation
      return MOCK_SHOPS;
    } catch (err) {
      console.warn('[Supabase] Error getting shops, using fallback:', err);
      return MOCK_SHOPS;
    } finally {
      this.endSync();
    }
  }

  public async updateShop(shopId: string, updates: Partial<Shop>): Promise<void> {
    this.startSync();
    try {
      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.tagline !== undefined) dbUpdates.tagline = updates.tagline;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.isOpen !== undefined) dbUpdates.is_open = updates.isOpen;
      if (updates.isRushHour !== undefined) dbUpdates.is_rush_hour = updates.isRushHour;
      if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
      if (updates.totalReviews !== undefined) dbUpdates.total_reviews = updates.totalReviews;
      if (updates.image !== undefined) dbUpdates.image = updates.image;
      if (updates.bannerImage !== undefined) dbUpdates.banner_image = updates.bannerImage;
      if (updates.contactPhone !== undefined) dbUpdates.contact_phone = updates.contactPhone;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.openingHours !== undefined) dbUpdates.opening_hours = updates.openingHours;

      await supabase.from('shops').update(dbUpdates).eq('id', shopId);
    } catch (err) {
      console.warn('[Supabase] Error updating shop:', err);
    } finally {
      this.endSync();
    }
  }

  // ============================================================
  // 3. CATEGORIES CRUD
  // ============================================================

  public async createCategory(category: ShopCategory): Promise<void> {
    this.startSync();
    try {
      await supabase.from('categories').upsert({
        id: category.id,
        name: category.name,
        icon_name: category.iconName,
        description: category.description,
        is_active: true,
      });
    } catch (err) {
      console.warn('[Supabase] Error creating category:', err);
    } finally {
      this.endSync();
    }
  }

  public async getCategories(): Promise<ShopCategory[]> {
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          name: d.name,
          iconName: d.icon_name || 'Utensils',
          description: d.description,
        }));
      }
      return MOCK_CATEGORIES;
    } catch (err) {
      console.warn('[Supabase] Error getting categories:', err);
      return MOCK_CATEGORIES;
    } finally {
      this.endSync();
    }
  }

  public async updateCategory(categoryId: string, updates: Partial<ShopCategory>): Promise<void> {
    this.startSync();
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.iconName !== undefined) dbUpdates.icon_name = updates.iconName;
      if (updates.description !== undefined) dbUpdates.description = updates.description;

      await supabase.from('categories').update(dbUpdates).eq('id', categoryId);
    } catch (err) {
      console.warn('[Supabase] Error updating category:', err);
    } finally {
      this.endSync();
    }
  }

  public async deleteCategory(categoryId: string): Promise<void> {
    this.startSync();
    try {
      await supabase.from('categories').delete().eq('id', categoryId);
    } catch (err) {
      console.warn('[Supabase] Error deleting category:', err);
    } finally {
      this.endSync();
    }
  }

  // ============================================================
  // 4. MENU ITEMS CRUD
  // ============================================================

  public async createMenuItem(item: MenuItem): Promise<void> {
    this.startSync();
    try {
      await supabase.from('menu_items').upsert({
        id: item.id,
        shop_id: item.shopId,
        category_id: item.categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        is_veg: item.isVeg,
        is_available: item.isAvailable,
        is_bestseller: item.isBestseller ?? false,
        preparation_time_min: item.preparationTimeMin ?? 5,
        preparation_minutes: item.preparationMinutes || '5-10',
        customization_options: item.customizationOptions || [],
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Supabase] Error creating menu item:', err);
    } finally {
      this.endSync();
    }
  }

  public async getMenuItems(shopId?: string): Promise<MenuItem[]> {
    this.startSync();
    try {
      let query = supabase.from('menu_items').select('*');
      if (shopId) {
        query = query.eq('shop_id', shopId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(normalizeMenuItemDoc);
      }
      return shopId ? MOCK_MENU_ITEMS.filter((i) => i.shopId === shopId) : MOCK_MENU_ITEMS;
    } catch (err) {
      console.warn('[Supabase] Error fetching menu items, using fallback:', err);
      return shopId ? MOCK_MENU_ITEMS.filter((i) => i.shopId === shopId) : MOCK_MENU_ITEMS;
    } finally {
      this.endSync();
    }
  }

  public async getMenuItemsByShop(shopId: string): Promise<MenuItem[]> {
    return this.getMenuItems(shopId);
  }

  public async updateMenuItem(itemId: string, updates: Partial<MenuItem>): Promise<void> {
    this.startSync();
    try {
      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.image !== undefined) dbUpdates.image = updates.image;
      if (updates.isVeg !== undefined) dbUpdates.is_veg = updates.isVeg;
      if (updates.isAvailable !== undefined) dbUpdates.is_available = updates.isAvailable;
      if (updates.isBestseller !== undefined) dbUpdates.is_bestseller = updates.isBestseller;
      if (updates.preparationTimeMin !== undefined) dbUpdates.preparation_time_min = updates.preparationTimeMin;

      await supabase.from('menu_items').update(dbUpdates).eq('id', itemId);
    } catch (err) {
      console.warn('[Supabase] Error updating menu item:', err);
    } finally {
      this.endSync();
    }
  }

  public async deleteMenuItem(itemId: string): Promise<void> {
    this.startSync();
    try {
      await supabase.from('menu_items').delete().eq('id', itemId);
    } catch (err) {
      console.warn('[Supabase] Error deleting menu item:', err);
    } finally {
      this.endSync();
    }
  }

  // ============================================================
  // 5. ORDERS CRUD
  // ============================================================

  public async saveOrder(order: Order): Promise<void> {
    assertValidOrderSubmission(order);
    this.startSync();

    try {
      const dbOrder = {
        id: order.id,
        shop_id: order.shopId,
        shop_name: order.shopName,
        shop_image: order.shopImage,
        shop_location: order.shopLocation,
        customer_id: order.customerId || null,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        token_number: order.tokenNumber,
        order_type: order.orderType || 'TAKEAWAY',
        table_number: order.tableNumber,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus || 'PENDING',
        order_status: order.orderStatus || 'PENDING',
        subtotal: order.subtotal,
        total: order.total,
        estimated_preparation_minutes: order.estimatedPreparationMinutes,
        instructions: order.instructions,
        cancellation_reason: order.cancellationReason,
        cancelled_at: order.cancelledAt,
        cancelled_by: order.cancelledBy,
        ready_at: order.readyAt,
        completed_at: order.completedAt,
        rating: order.rating,
        review_text: order.reviewText,
        reviewed_at: order.reviewedAt,
        feedback_tags: order.feedbackTags || [],
        is_demo: order.isDemo || false,
        created_at: order.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Save in orders table
      await supabase.from('orders').upsert(dbOrder);

      // 2. Save line items in order_items table
      if (order.items && order.items.length > 0) {
        const orderItemRows = order.items.map((it, idx) => ({
          id: `${order.id}-item-${idx}`,
          order_id: order.id,
          menu_item_id: it.menuItemId || it.id,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          is_veg: it.isVeg,
          created_at: order.createdAt || new Date().toISOString(),
        }));
        await supabase.from('order_items').upsert(orderItemRows);
      }

      // 3. Notify listeners
      notifyDatabaseOrderCommitted(order);
    } catch (err) {
      console.warn('[Supabase] Error saving order:', err);
    } finally {
      this.endSync();
    }
  }

  public async getOrder(orderId: string): Promise<Order | null> {
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (error || !data) return null;

      // Also fetch items snapshot
      const { data: itemRows } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      const items: OrderItem[] = (itemRows || []).map((it) => ({
        id: it.id,
        menuItemId: it.menu_item_id || it.id,
        name: it.name,
        price: Number(it.price),
        quantity: Number(it.quantity),
        isVeg: Boolean(it.is_veg),
      }));

      return normalizeOrderDoc({ ...data, items });
    } catch (err) {
      console.warn('[Supabase] Error getting order:', err);
      return null;
    } finally {
      this.endSync();
    }
  }

  public async getOrdersByShop(shopId: string): Promise<Order[]> {
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(normalizeOrderDoc);
      }
      return [];
    } catch (err) {
      console.warn('[Supabase] Error getting shop orders:', err);
      return [];
    } finally {
      this.endSync();
    }
  }

  public async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(normalizeOrderDoc);
      }
      return [];
    } catch (err) {
      console.warn('[Supabase] Error getting customer orders:', err);
      return [];
    } finally {
      this.endSync();
    }
  }

  public async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    details?: {
      cancellationReason?: string;
      cancelledAt?: string;
      cancelledBy?: 'customer' | 'owner' | 'system' | string;
      readyAt?: string;
      completedAt?: string;
    },
    changedBy?: string,
    note?: string
  ): Promise<void> {
    this.startSync();
    try {
      const now = new Date().toISOString();
      const updates: any = {
        order_status: status,
        updated_at: now,
      };

      if (status === 'READY') updates.ready_at = details?.readyAt || now;
      if (status === 'COMPLETED') updates.completed_at = details?.completedAt || now;
      if (status === 'CANCELLED') {
        updates.cancelled_at = now;
        updates.cancellation_reason = details?.cancellationReason || 'Cancelled';
        updates.cancelled_by = details?.cancelledBy || changedBy || 'system';
      }

      await supabase.from('orders').update(updates).eq('id', orderId);

      // Audit trail
      await supabase.from('order_status_history').insert({
        id: `${orderId}-status-${Date.now()}`,
        order_id: orderId,
        new_status: status,
        changed_by: changedBy || (details?.cancelledBy as string),
        note: note || details?.cancellationReason || `Status transitioned to ${status}`,
        created_at: now,
      });
    } catch (err) {
      console.warn('[Supabase] Error updating order status:', err);
    } finally {
      this.endSync();
    }
  }

  // ============================================================
  // 6. REALTIME SUBSCRIPTIONS
  // ============================================================

  public subscribeToShopOrders(
    shopId: string,
    onUpdate: (orders: Order[]) => void
  ): () => void {
    const channelName = `shop-orders-realtime-${shopId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    try {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `shop_id=eq.${shopId}`,
        },
        async () => {
          const fresh = await this.getOrdersByShop(shopId);
          onUpdate(fresh);
        }
      );
      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Supabase] Realtime shop orders unavailable for ${shopId}: ${status}`);
        }
      });
    } catch (err) {
      console.warn('[Supabase] Could not subscribe to shop orders realtime:', err);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }

  public subscribeToSingleOrder(
    orderId: string,
    onUpdate: (order: Order) => void
  ): () => void {
    const channelName = `single-order-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    try {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async () => {
          const fresh = await this.getOrder(orderId);
          if (fresh) onUpdate(fresh);
        }
      );
      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Supabase] Realtime order unavailable for ${orderId}: ${status}`);
        }
      });
    } catch (err) {
      console.warn('[Supabase] Could not subscribe to order realtime:', err);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ============================================================
  // 7. NOTIFICATIONS CRUD & REALTIME
  // ============================================================

  public async createNotification(notif: BusinessNotification): Promise<void> {
    this.startSync();
    try {
      await supabase.from('notifications').upsert({
        id: notif.id,
        shop_id: notif.shopId,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        token_number: notif.tokenNumber,
        amount: notif.amount,
        is_read: notif.isRead,
        order_id: notif.orderId,
        created_at: notif.createdAt || new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Supabase] Error creating notification:', err);
    } finally {
      this.endSync();
    }
  }

  public async getNotificationsByShop(shopId: string): Promise<BusinessNotification[]> {
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          shopId: d.shop_id,
          title: d.title,
          message: d.message,
          type: d.type as any,
          tokenNumber: d.token_number,
          orderId: d.order_id,
          amount: d.amount ? Number(d.amount) : undefined,
          isRead: Boolean(d.is_read),
          createdAt: d.created_at,
        }));
      }
      return [];
    } catch (err) {
      console.warn('[Supabase] Error getting notifications by shop:', err);
      return [];
    } finally {
      this.endSync();
    }
  }

  public subscribeToShopNotifications(
    shopId: string,
    onUpdate: (notifs: BusinessNotification[]) => void
  ): () => void {
    const channelName = `shop-notifs-${shopId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    try {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `shop_id=eq.${shopId}`,
        },
        async () => {
          const fresh = await this.getNotificationsByShop(shopId);
          onUpdate(fresh);
        }
      );
      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Supabase] Realtime notifications unavailable for ${shopId}: ${status}`);
        }
      });
    } catch (err) {
      console.warn('[Supabase] Could not subscribe to notifications realtime:', err);
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ============================================================
  // 8. REVIEWS & RATINGS CRUD
  // ============================================================

  public async saveOrderReview(
    orderId: string,
    rating: number,
    reviewText: string,
    feedbackTags: string[] = []
  ): Promise<void> {
    this.startSync();
    try {
      const now = new Date().toISOString();
      await supabase.from('orders').update({
        rating,
        review_text: reviewText,
        feedback_tags: feedbackTags,
        reviewed_at: now,
        updated_at: now,
      }).eq('id', orderId);
    } catch (err) {
      console.warn('[Supabase] Error saving order review:', err);
    } finally {
      this.endSync();
    }
  }

  // ============================================================
  // 9. DAILY TOKEN GENERATOR
  // ============================================================

  public async generateOrderToken(shopId: string): Promise<number> {
    try {
      // 1. Attempt atomic RPC call if generate_daily_shop_token exists in database
      const { data, error } = await supabase.rpc('generate_daily_shop_token', {
        p_shop_id: shopId,
      });

      if (!error && typeof data === 'number') {
        return data;
      }
    } catch {
      // ignore
    }

    // 2. Fallback: calculate from current day orders in orders table
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('token_number')
        .eq('shop_id', shopId)
        .gte('created_at', `${todayStr}T00:00:00.000Z`);

      const base = 100;
      const count = todayOrders ? todayOrders.length : 0;
      return base + count + 1;
    } catch {
      return Math.floor(100 + Math.random() * 900);
    }
  }
}

export const firestoreSync = new SupabaseSyncService();
export const supabaseSync = firestoreSync;
