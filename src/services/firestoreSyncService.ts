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
import { supabase, isSupabaseConfigured } from '../supabase';
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
  'deepak-chinese-corner',
  'shop-411159',
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
  'bangalore-tiffin',
]);

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

export function isFakeOrDefaultMenuItem(item: any): boolean {
  if (!item || !item.id) return true;
  // Strictly filter only items explicitly marked as demo
  if (item.isDemo === true || item.is_demo === true) return true;
  return false;
}

/**
 * Normalizes a database row or legacy document into standard frontend Shop interface.
 */
export function normalizeShopDoc(data: any): Shop {
  if (!data) {
    return MOCK_SHOPS[0];
  }

  const shopId = data.id || data.slug || 'shop-registered';
  const rawName = (data.name || data.shop_name || data.shopName || data.business_name || data.businessName || '').trim();

  let name = rawName;
  if (!name) {
    if (data.description) {
      name = data.description.split('.')[0].trim();
      name = name.charAt(0).toUpperCase() + name.slice(1);
    } else {
      name = 'Registered Food Stall';
    }
  }

  const desc = data.description || data.tagline || 'Fresh street food made to order';
  const area = data.area || 'Andheri West';
  const city = data.city || 'Mumbai';
  const address = data.address || data.location?.address || 'Street Counter';
  
  let lat = Number(data.latitude || data.location?.latitude || 19.1197);
  let lng = Number(data.longitude || data.location?.longitude || 72.8464);

  if (!lat || isNaN(lat)) lat = 19.1197;
  if (!lng || isNaN(lng)) lng = 72.8464;

  const image =
    data.image ||
    data.banner_image ||
    data.bannerImage ||
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';

  return {
    ...data,
    id: shopId,
    slug: data.slug || shopId,
    name,
    stallType: data.stall_type || data.stallType || 'Thela / Food Stall',
    tagline: data.tagline || desc,
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
    openingTime: data.opening_time || data.openingTime || '8:00 AM',
    closingTime: data.closing_time || data.closingTime || '10:00 PM',
    openingHours: data.opening_hours || data.openingHours || `${data.opening_time || data.openingTime || '8:00 AM'} – ${data.closing_time || data.closingTime || '10:00 PM'}`,
    rating: Number(data.rating) || 4.8,
    totalReviews: Number(data.total_reviews ?? data.totalReviews ?? 24),
    categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : ['fast-food', 'snacks'],
    preparationTimeMinutes: data.preparation_time_minutes || data.preparationTimeMinutes || '5–10',
    isPureVeg: data.is_pure_veg !== undefined ? Boolean(data.is_pure_veg) : (data.isPureVeg !== undefined ? Boolean(data.isPureVeg) : true),
    tableServiceAvailable: Boolean(data.table_service_available ?? data.tableServiceAvailable),
    featuredItem: data.featured_item || data.featuredItem || `${name} Special`,
    isDemo: Boolean(data.is_demo ?? data.isDemo),
    isActive: data.is_active !== undefined ? Boolean(data.is_active) : (data.isActive !== undefined ? Boolean(data.isActive) : true),
    isSuspended: Boolean(data.is_suspended ?? data.isSuspended),
    kycStatus: data.kyc_status || data.kycStatus || (data.status === 'pending_kyc' ? 'pending' : 'approved'),
    status: data.status || (Boolean(data.is_suspended ?? data.isSuspended) ? 'suspended' : 'active'),
    upiId: data.upi_id || data.upiId || undefined,
    upiqrpayApiKey: data.upiqrpay_api_key || data.upiqrpayApiKey,
    upiqrpayWebhookSecret: data.upiqrpay_webhook_secret || data.upiqrpayWebhookSecret,
    isOnlinePaymentEnabled: data.is_online_payment_enabled !== undefined ? Boolean(data.is_online_payment_enabled) : (data.isOnlinePaymentEnabled !== undefined ? Boolean(data.isOnlinePaymentEnabled) : true),
    merchantProvider: data.merchant_provider || data.merchantProvider || 'bharatpe',
  };
}

/**
 * Normalizes a database row into standard frontend Order interface.
 */
export function normalizeOrderDoc(data: any): Order {
  const paymentRow = Array.isArray(data.payments) ? data.payments[0] : data.payments;
  const utrNumber =
    data.utr_number ||
    data.utrNumber ||
    paymentRow?.utr_number ||
    paymentRow?.transaction_id ||
    undefined;

  const rawItems = Array.isArray(data.items) && data.items.length > 0
    ? data.items
    : Array.isArray(data.order_items)
    ? data.order_items.map((it: any) => ({
        id: it.id,
        menuItemId: it.menu_item_id || it.menuItemId || it.id,
        name: it.name,
        price: Number(it.price || 0),
        quantity: Number(it.quantity || 1),
        isVeg: it.is_veg !== undefined ? Boolean(it.is_veg) : Boolean(it.isVeg ?? true),
      }))
    : [];

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
    utrNumber,
    orderStatus: data.order_status || data.orderStatus || 'PENDING',
    items: rawItems,
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
  // Map generic cat-1 or unmapped category to a valid shop category
  let catId = String(data.category_id || data.categoryId || '').toLowerCase().trim();
  if (!catId || catId === 'cat-1' || catId === 'default') {
    const name = String(data.name || '').toLowerCase();
    if (name.includes('chai') || name.includes('tea') || name.includes('coffee')) catId = 'tea-coffee';
    else if (name.includes('vada') || name.includes('pav')) catId = 'vada-pav';
    else if (name.includes('sandwich') || name.includes('toast')) catId = 'sandwich';
    else if (name.includes('juice') || name.includes('shake')) catId = 'juice';
    else if (name.includes('dosa') || name.includes('idli') || name.includes('poha')) catId = 'breakfast';
    else if (name.includes('paneer') || name.includes('roti') || name.includes('rice') || name.includes('dal') || name.includes('thali') || name.includes('curry') || name.includes('bhaji') || name.includes('maggi') || name.includes('noodle')) catId = 'fast-food';
    else catId = 'snacks';
  }

  // Handle fallback image if empty or broken
  let img = data.image || '';
  if (!img || typeof img !== 'string' || img.trim() === '') {
    img = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
  }

  return {
    id: data.id,
    shopId: data.shop_id || data.shopId,
    categoryId: catId,
    name: data.name,
    description: data.description || '',
    price: Number(data.price || 0),
    image: img,
    isAvailable: data.is_available !== false && data.isAvailable !== false,
    isVeg: data.is_veg !== false && data.isVeg !== false,
    isBestseller: Boolean(data.is_bestseller || data.isBestseller),
    preparationTimeMin: Number(data.preparation_time_min ?? data.preparationTimeMin ?? 5),
    preparationMinutes: data.preparation_minutes || data.preparationMinutes || '5-10',
    customizationOptions: data.customization_options || data.customizationOptions || [],
    // Preserve isDemo so callers can filter out seeded-demo items
    isDemo: Boolean(data.is_demo ?? data.isDemo),
  } as MenuItem & { isDemo: boolean };
}

/**
 * Generates high quality, signature street food menu items for stalls that do not
 * yet have full menus in the cloud DB, ensuring customers never encounter an empty screen.
 */
export function generateDefaultShopMenu(shopId: string, slug?: string): MenuItem[] {
  const sid = shopId || slug || 'shop';
  return [
    {
      id: `${sid}-item-1`,
      shopId: sid,
      categoryId: 'fast-food',
      name: 'Special Amul Butter Pav Bhaji',
      description: 'Slow-cooked spiced mashed vegetable bhaji loaded with pure Amul butter. Served with soft toasted buttery pavs and onion lemon salad.',
      price: 120,
      image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isVeg: true,
      isBestseller: true,
      preparationTimeMin: 10,
      preparationMinutes: '8-12',
      customizationOptions: [],
    },
    {
      id: `${sid}-item-2`,
      shopId: sid,
      categoryId: 'vada-pav',
      name: 'Mumbai Cheese Vada Pav',
      description: 'Golden fried spicy potato dumpling coated in chickpea batter with melted Amul cheese slice and fiery garlic thecha.',
      price: 35,
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isVeg: true,
      isBestseller: true,
      preparationTimeMin: 5,
      preparationMinutes: '3-5',
      customizationOptions: [],
    },
    {
      id: `${sid}-item-3`,
      shopId: sid,
      categoryId: 'sandwich',
      name: 'Bombay Veg Grilled Cheese Sandwich',
      description: 'Layered toast with sliced potatoes, cucumber, tomatoes, spicy green chutney and shredded cheddar cheese, grilled till golden crisp.',
      price: 90,
      image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isVeg: true,
      isBestseller: false,
      preparationTimeMin: 8,
      preparationMinutes: '7-10',
      customizationOptions: [],
    },
    {
      id: `${sid}-item-4`,
      shopId: sid,
      categoryId: 'tea-coffee',
      name: 'Adrak Elaichi Cutting Chai',
      description: 'Special kadak cutting chai boiled with freshly pounded ginger, crushed green cardamom pods, and creamy buffalo milk.',
      price: 15,
      image: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isVeg: true,
      isBestseller: true,
      preparationTimeMin: 3,
      preparationMinutes: '3-5',
      customizationOptions: [],
    },
    {
      id: `${sid}-item-5`,
      shopId: sid,
      categoryId: 'snacks',
      name: 'Crispy Samosa Chaat Plate (2 Pcs)',
      description: 'Crispy Punjabi samosas crushed and smothered with hot chole ragda, chilled sweet yogurt, spicy mint chutney, and sev.',
      price: 60,
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isVeg: true,
      isBestseller: false,
      preparationTimeMin: 5,
      preparationMinutes: '5-8',
      customizationOptions: [],
    },
    {
      id: `${sid}-item-6`,
      shopId: sid,
      categoryId: 'juice',
      name: 'Fresh Mosambi Citrus Juice',
      description: 'Pure freshly squeezed sweet lime juice with black salt and roasted jeera. Refreshing and nutritious with no added water.',
      price: 50,
      image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isVeg: true,
      isBestseller: false,
      preparationTimeMin: 4,
      preparationMinutes: '3-5',
      customizationOptions: [],
    },
  ];
}

class SupabaseSyncService {
  private isInitialized = false;
  private activeSyncCount = 0;
  private syncListeners = new Set<SyncListener>();

  // In-memory caching & request deduplication for ultra-fast performance
  private cachedShops: Shop[] | null = null;
  private lastShopsFetchTime = 0;
  private shopsInflightPromise: Promise<Shop[]> | null = null;
  private readonly SHOPS_CACHE_TTL_MS = 25000; // 25 seconds TTL

  private cachedCategories: ShopCategory[] | null = null;
  private lastCategoriesFetchTime = 0;
  private readonly CATEGORIES_CACHE_TTL_MS = 120000; // 2 minutes TTL

  public invalidateShopsCache() {
    this.cachedShops = null;
    this.lastShopsFetchTime = 0;
  }

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
    if (this.isInitialized || !isSupabaseConfigured) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('foodflow_db_initialized')) {
      this.isInitialized = true;
      return;
    }
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
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('foodflow_db_initialized', 'true');
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
        upiqrpay_api_key: shop.upiqrpayApiKey || null,
        upiqrpay_webhook_secret: shop.upiqrpayWebhookSecret || null,
        is_online_payment_enabled: shop.isOnlinePaymentEnabled !== false,
        merchant_provider: shop.merchantProvider || 'bharatpe',
        updated_at: new Date().toISOString(),
      };

      await supabase.from('shops').upsert(dbShop);
      this.invalidateShopsCache();
    } catch (err) {
      console.warn('[Supabase] Error creating shop:', err);
    } finally {
      this.endSync();
    }
  }

  public async saveShop(shop: Shop): Promise<void> {
    return this.createShop(shop);
  }

  public async getShop(shopIdOrSlug: string): Promise<Shop | null> {
    if (!shopIdOrSlug) return null;
    const clean = decodeURIComponent(String(shopIdOrSlug)).trim().replace(/^\/shop\//, '').replace(/\/$/, '');
    const cleanLower = clean.toLowerCase();
    const cleanAlpha = cleanLower.replace(/[^a-z0-9]/g, '');

    const matchesShop = (s: Shop) => {
      if (!s) return false;
      const sId = (s.id || '').toLowerCase().trim();
      const sSlug = (s.slug || '').toLowerCase().trim();
      const sName = (s.name || '').toLowerCase().trim();
      if (sId === cleanLower || sSlug === cleanLower || sName === cleanLower) return true;
      if (cleanAlpha) {
        if (
          sId.replace(/[^a-z0-9]/g, '') === cleanAlpha ||
          sSlug.replace(/[^a-z0-9]/g, '') === cleanAlpha ||
          sName.replace(/[^a-z0-9]/g, '') === cleanAlpha
        ) {
          return true;
        }
      }
      return false;
    };

    // 1. Instant check in memory cache (0ms)
    if (this.cachedShops && this.cachedShops.length > 0) {
      const cachedMatch = this.cachedShops.find(matchesShop);
      if (cachedMatch) return cachedMatch;
    }

    if (!isSupabaseConfigured) return null;

    this.startSync();
    try {
      // 2. Check via getShops() which uses safe select('*') without fragile .or()/.maybeSingle() errors
      const allShops = await this.getShops();
      const matchedFromAll = allShops.find(matchesShop);
      if (matchedFromAll) return matchedFromAll;

      // 3. Direct fallback query on shops table
      const { data, error } = await supabase
        .from('shops')
        .select('*');

      if (!error && Array.isArray(data) && data.length > 0) {
        const normalizedAll = data.map((d) => normalizeShopDoc(d));
        const directMatch = normalizedAll.find(matchesShop);
        if (directMatch) return directMatch;
      }

      return null;
    } catch (err) {
      console.warn('[Supabase] Error getting shop:', err);
      return null;
    } finally {
      this.endSync();
    }
  }

  public async deleteShop(shopId: string): Promise<boolean> {
    if (!shopId) return false;
    this.startSync();
    try {
      if (isSupabaseConfigured) {
        // Delete child rows (orders, menu_items, shop_categories) and the shop itself
        await Promise.allSettled([
          supabase.from('orders').delete().eq('shop_id', shopId),
          supabase.from('menu_items').delete().eq('shop_id', shopId),
          supabase.from('shop_categories').delete().eq('shop_id', shopId),
        ]);
        const { error } = await supabase.from('shops').delete().eq('id', shopId);
        if (error) {
          console.warn('[Supabase] Delete shop error:', error);
        }
      }
      // Also purge any local cached orders belonging to this deleted shop
      try {
        const storedOrdersRaw = localStorage.getItem('foodflow_customer_orders');
        if (storedOrdersRaw) {
          const parsedOrders = JSON.parse(storedOrdersRaw);
          if (Array.isArray(parsedOrders)) {
            const targetLower = shopId.trim().toLowerCase();
            const filtered = parsedOrders.filter(
              (o: Order) => String(o?.shopId || '').trim().toLowerCase() !== targetLower
            );
            localStorage.setItem('foodflow_customer_orders', JSON.stringify(filtered));
          }
        }
      } catch {}
      this.invalidateShopsCache();
      return true;
    } catch (err) {
      console.warn('[Supabase] Exception in deleteShop:', err);
      return false;
    } finally {
      this.endSync();
    }
  }

  public async getShops(isRealUser?: boolean): Promise<Shop[]> {
    const deletedRaw = typeof window !== 'undefined' ? localStorage.getItem('foodflow_deleted_shops') : null;
    const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);

    if (!isSupabaseConfigured) {
      try {
        const stored = localStorage.getItem('foodflow_registered_shops');
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list) && list.length > 0) {
            const clean = list.filter((s: Shop) => !s.isDemo && !MOCK_SHOP_IDS.has(s.id) && !deletedSet.has(s.id));
            if (clean.length > 0) return clean;
          }
        }
      } catch {}
      return MOCK_SHOPS.filter((s) => !deletedSet.has(s.id) && !isShopSuspendedOrKycPending(s));
    }

    const now = Date.now();
    // Return instant memory cache if fresh
    if (this.cachedShops && (now - this.lastShopsFetchTime < this.SHOPS_CACHE_TTL_MS)) {
      return this.cachedShops;
    }

    // Coalesce in-flight queries so multiple components don't spam the network simultaneously
    if (this.shopsInflightPromise) {
      return this.shopsInflightPromise;
    }

    this.shopsInflightPromise = (async () => {
      this.startSync();
      try {
        // Fetch strictly from Supabase shops table
        const { data: remoteShops, error } = await supabase
          .from('shops')
          .select('*');

        if (!error && Array.isArray(remoteShops)) {
          // Return live shops present in the database (even if 0 shops when all are deleted)
          const liveShops = remoteShops
            .map((d) => normalizeShopDoc(d))
            .filter(
              (s) =>
                !s.isDemo &&
                !MOCK_SHOP_IDS.has(s.id) &&
                !MOCK_SHOP_IDS.has(s.slug) &&
                !deletedSet.has(s.id) &&
                !isShopSuspendedOrKycPending(s)
            );

          this.cachedShops = liveShops;
          this.lastShopsFetchTime = Date.now();

          try {
            localStorage.setItem('foodflow_shops', JSON.stringify(liveShops));
            localStorage.setItem('foodflow_shops_list', JSON.stringify(liveShops));
            localStorage.removeItem('foodflow_registered_shops');
          } catch {}

          return liveShops;
        }

        if (this.cachedShops) return this.cachedShops;
        return [];
      } catch (err) {
        console.warn('[Supabase] Error getting shops:', err);
        if (this.cachedShops) return this.cachedShops;
        return [];
      } finally {
        this.shopsInflightPromise = null;
        this.endSync();
      }
    })();

    return this.shopsInflightPromise;
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
      this.invalidateShopsCache();
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
      this.cachedCategories = null;
    } catch (err) {
      console.warn('[Supabase] Error creating category:', err);
    } finally {
      this.endSync();
    }
  }

  public async getCategories(): Promise<ShopCategory[]> {
    const now = Date.now();
    if (this.cachedCategories && (now - this.lastCategoriesFetchTime < this.CATEGORIES_CACHE_TTL_MS)) {
      return this.cachedCategories;
    }

    this.startSync();
    try {
      const query = supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Categories timed out') }), 3500)
      );

      const { data, error } = await Promise.race([query, timeoutPromise]);

      if (!error && data && data.length > 0) {
        const cats = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          iconName: d.icon_name || 'Utensils',
          description: d.description,
        }));
        this.cachedCategories = cats;
        this.lastCategoriesFetchTime = Date.now();
        return cats;
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
      let effectiveShopId = item.shopId;
      // Resolve slug to shop.id if needed so foreign key constraint never fails
      try {
        const { data: matchedShop } = await supabase
          .from('shops')
          .select('id, slug')
          .or(`id.eq.${item.shopId},slug.eq.${item.shopId}`)
          .maybeSingle();
        if (matchedShop?.id) {
          effectiveShopId = matchedShop.id;
        }
      } catch {}

      const basePayload: any = {
        id: item.id,
        shop_id: effectiveShopId,
        category_id: item.categoryId || null,
        name: item.name,
        description: item.description || '',
        price: item.price,
        image: item.image,
        is_veg: item.isVeg,
        is_available: item.isAvailable,
        is_bestseller: item.isBestseller ?? false,
        preparation_time_min: item.preparationTimeMin ?? 5,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('menu_items').upsert({
        ...basePayload,
        preparation_minutes: item.preparationMinutes || '5-10',
        customization_options: item.customizationOptions || [],
      });

      if (error) {
        console.warn('[Supabase] Initial menu item upsert note:', error.message);
        // Fallback 1: Try base payload
        const { error: err1 } = await supabase.from('menu_items').upsert(basePayload);
        if (err1) {
          // Fallback 2: Category ID may violate foreign key constraint — retry with category_id = null
          console.warn('[Supabase] Retrying menu item upsert with category_id = null:', err1.message);
          const safePayload = { ...basePayload, category_id: null };
          const { error: err2 } = await supabase.from('menu_items').upsert(safePayload);
          if (err2) {
            console.error('[Supabase] Fatal error creating menu item in database:', err2.message);
          }
        }
      }
    } catch (err) {
      console.warn('[Supabase] Error creating menu item:', err);
    } finally {
      this.endSync();
    }
  }

  public async getMenuItems(shopId?: string, slug?: string): Promise<MenuItem[]> {
    let localItems: MenuItem[] = [];
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('foodflow_menu_items');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            localItems = isSupabaseConfigured
              ? parsed.filter((i) => !isFakeOrDefaultMenuItem(i))
              : parsed;
          }
        }
      }
    } catch {
      // fallback
    }

    const cleanTargetId = (shopId || '').toLowerCase().trim();
    const cleanSlug = (slug || '').toLowerCase().trim();
    const targetAlpha = cleanTargetId.replace(/[^a-z0-9]/g, '');
    const slugAlpha = cleanSlug.replace(/[^a-z0-9]/g, '');

    // Resolve bidirectional shop ID and Slug from cached or stored shops
    let resolvedShopId = cleanTargetId;
    let resolvedSlug = cleanSlug;
    try {
      const knownShops: Shop[] = this.cachedShops || [];
      let foundShop = knownShops.find(
        (s) =>
          (s.id && s.id.toLowerCase() === cleanTargetId) ||
          (s.slug && s.slug.toLowerCase() === cleanTargetId) ||
          (cleanSlug && s.id && s.id.toLowerCase() === cleanSlug) ||
          (cleanSlug && s.slug && s.slug.toLowerCase() === cleanSlug) ||
          (targetAlpha && s.id && s.id.toLowerCase().replace(/[^a-z0-9]/g, '') === targetAlpha) ||
          (targetAlpha && s.slug && s.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === targetAlpha)
      );

      if (!foundShop && typeof localStorage !== 'undefined') {
        const storedRaw = localStorage.getItem('foodflow_shops') || localStorage.getItem('foodflow_shops_list');
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw);
          if (Array.isArray(parsed)) {
            foundShop = parsed.find(
              (s: any) =>
                (s.id && s.id.toLowerCase() === cleanTargetId) ||
                (s.slug && s.slug.toLowerCase() === cleanTargetId) ||
                (cleanSlug && s.id && s.id.toLowerCase() === cleanSlug) ||
                (cleanSlug && s.slug && s.slug.toLowerCase() === cleanSlug) ||
                (targetAlpha && s.id && s.id.toLowerCase().replace(/[^a-z0-9]/g, '') === targetAlpha) ||
                (targetAlpha && s.slug && s.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === targetAlpha)
            );
          }
        }
      }

      if (foundShop) {
        if (foundShop.id) resolvedShopId = foundShop.id.toLowerCase().trim();
        if (foundShop.slug) resolvedSlug = (foundShop.slug || '').toLowerCase().trim();
      }
    } catch {}

    const resolvedIdAlpha = resolvedShopId.replace(/[^a-z0-9]/g, '');
    const resolvedSlugAlpha = resolvedSlug.replace(/[^a-z0-9]/g, '');

    const isShopItemMatch = (itemShopId?: string): boolean => {
      if (!shopId) return true;
      const sid = (itemShopId || '').toLowerCase().trim();
      if (!sid) return false;
      const sidAlpha = sid.replace(/[^a-z0-9]/g, '');

      if (sid === cleanTargetId || (cleanSlug && sid === cleanSlug)) return true;
      if (resolvedShopId && sid === resolvedShopId) return true;
      if (resolvedSlug && sid === resolvedSlug) return true;
      if (targetAlpha && sidAlpha === targetAlpha) return true;
      if (slugAlpha && sidAlpha === slugAlpha) return true;
      if (resolvedIdAlpha && sidAlpha === resolvedIdAlpha) return true;
      if (resolvedSlugAlpha && sidAlpha === resolvedSlugAlpha) return true;
      return false;
    };

    if (!isSupabaseConfigured) {
      const filteredLocal = shopId
        ? localItems.filter((i) => isShopItemMatch(i.shopId))
        : localItems;

      return filteredLocal;
    }

    this.startSync();
    try {
      // Phase 3 SQL Optimization: Select only menu fields and filter by shop_id on server
      let baseQuery = supabase
        .from('menu_items')
        .select('id, shop_id, name, description, price, image, is_veg, is_available, is_bestseller, preparation_time_min, category_id, is_demo, created_at, updated_at');

      if (shopId) {
        if (slug && slug !== shopId) {
          baseQuery = baseQuery.or(`shop_id.eq.${shopId},shop_id.eq.${slug}`);
        } else {
          baseQuery = baseQuery.eq('shop_id', shopId);
        }
      }

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Menu query timed out') }), 6000)
      );
      const { data, error } = await Promise.race([baseQuery, timeoutPromise]);

      if (!error && Array.isArray(data)) {
        // Only strip items explicitly marked as demo in the raw DB row.
        // Do NOT generate or inject any fake/default items — show only what the shop owner added.
        const allRemote = data
          .filter((row: any) => !row.is_demo)
          .map(normalizeMenuItemDoc);

        // Merge DB items with any locally stored items that haven't synced yet
        const unSyncedLocal = localItems.filter((loc) => {
          return !allRemote.some((rem) => rem.id === loc.id);
        });
        if (unSyncedLocal.length > 0) {
          // Attempt to push any un-synced items to DB in the background
          unSyncedLocal.forEach((it) => this.createMenuItem(it).catch(() => {}));
        }

        const combinedItems = [...allRemote, ...unSyncedLocal];

        const remoteList = shopId
          ? combinedItems.filter((i) => isShopItemMatch(i.shopId))
          : combinedItems;

        // Update local cache with combined items (never wipe out un-synced items)
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('foodflow_menu_items', JSON.stringify(combinedItems));
          }
        } catch {}

        // Return exactly what is in DB / owner added — empty array if shop owner has not added any items yet
        return remoteList;
      }

      // Network timed out — fall back to local cache only (no fake items injected)
      const filteredLocal = shopId
        ? localItems.filter((i) => isShopItemMatch(i.shopId))
        : localItems;

      return filteredLocal;
    } catch (err) {
      console.warn('[Supabase] Error fetching menu items, using clean local fallback:', err);
      const filteredLocal = shopId
        ? localItems.filter((i) => isShopItemMatch(i.shopId))
        : localItems;

      return filteredLocal;
    } finally {
      this.endSync();
    }
  }

  public async getMenuItemsByShop(shopId: string, slug?: string): Promise<MenuItem[]> {
    return this.getMenuItems(shopId, slug);
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
      const safePaymentStatus =
        order.paymentStatus === 'INITIATED' || order.paymentStatus === 'PROCESSING'
          ? 'PENDING'
          : order.paymentStatus || 'PENDING';

      // 0. Resolve canonical shop primary key in case order.shopId was a slug or custom reference
      let resolvedShopId = order.shopId;
      try {
        const { data: matchedShop } = await supabase
          .from('shops')
          .select('id')
          .or(`id.eq.${order.shopId},slug.eq.${order.shopId}`)
          .maybeSingle();
        if (matchedShop?.id) {
          resolvedShopId = matchedShop.id;
        }
      } catch (resolveErr) {
        console.warn('[Supabase] Warning resolving shop ID:', resolveErr);
      }

      const dbOrder = {
        id: order.id,
        shop_id: resolvedShopId,
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
        payment_status: safePaymentStatus,
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
        items: order.items || [],
        is_demo: order.isDemo || false,
        created_at: order.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Save in orders table
      const { error: orderError } = await supabase.from('orders').upsert(dbOrder);
      if (orderError) {
        console.warn('[Supabase] Client direct order save returned error, attempting serverless fallback:', orderError);
        let fallbackSucceeded = false;
        try {
          const serverRes = await fetch('/api/order/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order, dbOrder }),
          });
          const serverJson = await serverRes.json().catch(() => null);
          if (serverRes.ok && serverJson?.success) {
            fallbackSucceeded = true;
          }
        } catch (apiErr) {
          console.warn('[Supabase] Serverless fallback error:', apiErr);
        }

        if (!fallbackSucceeded) {
          console.error('[Supabase] Error saving order to PostgreSQL:', orderError);
          // Never silently swallow database errors during checkout — surface actionable error
          throw new Error(
            `Failed to save order to PostgreSQL: ${orderError.message || 'Database error'}. Code: ${orderError.code || 'UNKNOWN'}`
          );
        }
      }

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
        const { error: itemsError } = await supabase.from('order_items').upsert(orderItemRows);
        if (itemsError) {
          console.error('[Supabase] Error saving order_items:', itemsError);
        }
      }

      // 3. Save payment record in payments table (with UTR in transaction_id)
      if (order.paymentMethod === 'PAY_ONLINE' || order.utrNumber) {
        const now = new Date().toISOString();
        const { error: payError } = await supabase.from('payments').upsert({
          id: `pay-${order.id}`,
          order_id: order.id,
          shop_id: resolvedShopId,
          payment_mode: order.paymentMethod || 'PAY_ONLINE',
          payment_status: safePaymentStatus,
          amount: order.total,
          transaction_id: order.utrNumber || null,
          provider: order.utrNumber ? 'direct_upi_utr' : 'upiqrpay',
          paid_at: safePaymentStatus === 'PAID' ? now : null,
          updated_at: now,
        });
        if (payError) {
          console.error('[Supabase] Error saving payments:', payError);
        }
      }

      // 4. Notify listeners
      notifyDatabaseOrderCommitted({
        ...order,
        shopId: resolvedShopId,
      });
    } catch (err) {
      console.error('[Supabase] Error saving order:', err);
      throw err;
    } finally {
      this.endSync();
    }
  }

  public async getOrder(orderId: string): Promise<Order | null> {
    this.startSync();
    try {
      const [{ data, error }, liveShops] = await Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
        this.getShops(true),
      ]);

      if (error || !data) return null;

      // Verify that the order's shop still exists in the live shops table
      const orderShopId = String(data.shop_id || data.shopId || '').trim().toLowerCase();
      const shopExists = liveShops.some(
        (s) =>
          String(s.id || '').trim().toLowerCase() === orderShopId ||
          (s.slug && String(s.slug).trim().toLowerCase() === orderShopId)
      );

      if (!shopExists) {
        // Shop was deleted from the database — clean up orphaned order row in background and return null
        supabase.from('orders').delete().eq('id', orderId).then(() => {});
        return null;
      }

      // Fetch items snapshot and payment UTR in parallel
      const [{ data: itemRows }, { data: paymentRow }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', orderId),
        supabase
          .from('payments')
          .select('transaction_id, payment_status, paid_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const items: OrderItem[] = (itemRows || []).map((it) => ({
        id: it.id,
        menuItemId: it.menu_item_id || it.id,
        name: it.name,
        price: Number(it.price),
        quantity: Number(it.quantity),
        isVeg: Boolean(it.is_veg),
      }));

      return normalizeOrderDoc({
        ...data,
        items,
        utr_number: paymentRow?.transaction_id || data.utr_number,
      });
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
        .select('*, order_items(*), payments(transaction_id, payment_status, paid_at)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(normalizeOrderDoc);
      }

      // Fallback if relational join is unavailable
      const { data: fallbackData } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (fallbackData) {
        return fallbackData.map(normalizeOrderDoc);
      }
      return [];
    } catch (err) {
      console.warn('[Supabase] Error getting shop orders:', err);
      return [];
    } finally {
      this.endSync();
    }
  }

  public async getOrdersByCustomer(customerId: string, limit: number = 25): Promise<Order[]> {
    this.startSync();
    try {
      // Reuse fresh shops cache instead of executing redundant full database scans
      const liveShopsPromise = this.cachedShops && (Date.now() - this.lastShopsFetchTime < this.SHOPS_CACHE_TTL_MS)
        ? Promise.resolve(this.cachedShops)
        : this.getShops(true);

      const [primaryRes, liveShops] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(*), payments(transaction_id, payment_status, paid_at)')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(limit),
        liveShopsPromise,
      ]);

      const validShopSet = new Set<string>();
      for (const s of liveShops) {
        if (s.id) validShopSet.add(String(s.id).trim().toLowerCase());
        if (s.slug) validShopSet.add(String(s.slug).trim().toLowerCase());
      }

      let rawOrders: Order[] = [];
      if (!primaryRes.error && primaryRes.data) {
        rawOrders = primaryRes.data.map(normalizeOrderDoc);
      } else {
        const { data: fallbackData } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });
        if (fallbackData) {
          rawOrders = fallbackData.map(normalizeOrderDoc);
        }
      }

      // Filter out any order whose shop was deleted from the database, and clean up orphaned rows
      const orphanedIds: string[] = [];
      const activeShopOrders = rawOrders.filter((o) => {
        const sid = String(o.shopId || '').trim().toLowerCase();
        if (!sid || !validShopSet.has(sid)) {
          if (o.id) orphanedIds.push(o.id);
          return false;
        }
        return true;
      });

      if (orphanedIds.length > 0) {
        supabase.from('orders').delete().in('id', orphanedIds).then(() => {});
      }

      return activeShopOrders;
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
      paymentStatus?: PaymentStatus;
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

      if (details?.paymentStatus) {
        updates.payment_status = details.paymentStatus;
      }
      if (status === 'READY') updates.ready_at = details?.readyAt || now;
      if (status === 'COMPLETED') updates.completed_at = details?.completedAt || now;
      if (status === 'CANCELLED') {
        updates.cancelled_at = now;
        updates.cancellation_reason = details?.cancellationReason || 'Cancelled';
        updates.cancelled_by = details?.cancelledBy || changedBy || 'system';
      }

      await supabase.from('orders').update(updates).eq('id', orderId);

      if (details?.paymentStatus) {
        await supabase
          .from('payments')
          .update({
            payment_status: details.paymentStatus,
            ...(details.paymentStatus === 'PAID' ? { paid_at: now } : {}),
            updated_at: now,
          })
          .eq('order_id', orderId);
      }

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

  public async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: 'PAID' | 'FAILED' | 'PENDING',
    utrNumber?: string
  ): Promise<void> {
    if (!isSupabaseConfigured || !orderId) return;
    this.startSync();
    try {
      const now = new Date().toISOString();
      await supabase
        .from('orders')
        .update({
          payment_status: paymentStatus,
          updated_at: now,
        })
        .eq('id', orderId);

      const paymentUpdate: any = {
        payment_status: paymentStatus,
        updated_at: now,
      };
      if (utrNumber) paymentUpdate.transaction_id = utrNumber;
      if (paymentStatus === 'PAID') paymentUpdate.paid_at = now;

      await supabase.from('payments').update(paymentUpdate).eq('order_id', orderId);
    } catch (err) {
      console.warn('[Supabase] Error updating order payment status:', err);
    } finally {
      this.endSync();
    }
  }

  /**
   * Anti-Replay check: Verifies whether a 12-digit UPI UTR has already been used
   * in any previous order in Supabase or local storage.
   */
  public async isUtrAlreadyUsed(utrNumber: string, excludeOrderId?: string): Promise<boolean> {
    const cleanUtr = (utrNumber || '').trim();
    if (!cleanUtr) return false;

    // 1. Check local storage orders first
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('foodflow_customer_orders');
        if (stored) {
          const orders: Order[] = JSON.parse(stored);
          const duplicateLocal = orders.some(
            (o) =>
              o.utrNumber === cleanUtr &&
              o.id !== excludeOrderId &&
              o.paymentStatus !== 'FAILED' &&
              o.orderStatus !== 'CANCELLED'
          );
          if (duplicateLocal) return true;
        }
      }
    } catch {}

    if (!isSupabaseConfigured) return false;

    // 2. Check Supabase payments table for existing transaction_id
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id, order_id, payment_status')
        .eq('transaction_id', cleanUtr)
        .limit(5);

      if (!error && Array.isArray(data) && data.length > 0) {
        const activeMatch = data.some(
          (row) => row.order_id !== excludeOrderId && row.payment_status !== 'FAILED'
        );
        if (activeMatch) return true;
      }
    } catch (err) {
      console.warn('[Supabase] Error checking UTR uniqueness:', err);
    }

    return false;
  }

  // ============================================================
  // 5b. PAYMENTS OPERATIONS
  // ============================================================

  public async getPaymentForOrder(orderId: string): Promise<PaymentRecord | null> {
    if (!isSupabaseConfigured || !orderId) return null;
    this.startSync();
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        orderId: data.order_id,
        shopId: data.shop_id,
        customerId: data.customer_id,
        currency: data.currency || 'INR',
        paymentMode: data.payment_mode,
        paymentStatus: data.payment_status,
        amount: Number(data.amount || 0),
        transactionId: data.transaction_id,
        providerPaymentId: data.provider_payment_id,
        providerOrderId: data.provider_order_id,
        merchantRef: data.merchant_ref,
        qrCodeData: data.qr_code_data,
        upiIntentUrl: data.upi_intent_url,
        utrNumber: data.utr_number || data.transaction_id,
        provider: data.provider,
        failureReason: data.failure_reason,
        rawPayload: data.raw_payload,
        paidAt: data.paid_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.warn('[Supabase] Error getting payment record:', err);
      return null;
    } finally {
      this.endSync();
    }
  }

  public async savePaymentRecord(payment: Partial<PaymentRecord> & { orderId: string }): Promise<void> {
    if (!isSupabaseConfigured || !payment.orderId) return;
    this.startSync();
    try {
      const paymentId = payment.id || `pay-${payment.orderId}`;
      const now = new Date().toISOString();

      const dbPayment: any = {
        id: paymentId,
        order_id: payment.orderId,
        payment_mode: payment.paymentMode || 'PAY_ONLINE',
        payment_status: payment.paymentStatus || 'PENDING',
        amount: payment.amount ?? 0,
        transaction_id: payment.utrNumber || payment.transactionId || null,
        provider: payment.provider || 'direct_upi_utr',
        paid_at: payment.paidAt || null,
        updated_at: now,
      };

      await supabase.from('payments').upsert(dbPayment);
    } catch (err) {
      console.warn('[Supabase] Error saving payment record:', err);
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
  // 8.5 REALTIME SHOP SUBSCRIPTION
  // ============================================================

  public subscribeToShopList(onChange: (shops: Shop[]) => void): () => void {
    if (!isSupabaseConfigured) {
      return () => {};
    }
    try {
      const channel = supabase
        .channel('realtime_shops_list')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shops' },
          async (payload) => {
            console.log('[SupabaseRealtime] Shops change event:', payload.eventType);
            this.invalidateShopsCache();
            const liveShops = await this.getShops(true);
            onChange(liveShops);
          }
        )
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      };
    } catch (err) {
      console.warn('[Supabase] Could not subscribe to shops list realtime:', err);
      return () => {};
    }
  }

  // ============================================================
  // 9. DAILY TOKEN GENERATOR
  // ============================================================

  public async generateOrderToken(shopId: string): Promise<number> {
    const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
    const dailyTokensKey = `foodflow_daily_tokens_${shopId}_${todayStr}`;
    const usedToday = new Set<number>();

    // 1. Check daily tokens reservation cache
    try {
      const storedDaily = localStorage.getItem(dailyTokensKey);
      if (storedDaily) {
        const parsed = JSON.parse(storedDaily);
        if (Array.isArray(parsed)) {
          parsed.forEach((t) => {
            const num = parseInt(String(t), 10);
            if (!isNaN(num)) usedToday.add(num);
          });
        }
      }
    } catch {
      // ignore
    }

    // 2. Check local orders created TODAY for this shop (ignore demo/mock orders)
    try {
      const stored = localStorage.getItem('foodflow_customer_orders');
      if (stored) {
        const localList = JSON.parse(stored);
        if (Array.isArray(localList)) {
          for (const ord of localList) {
            if (ord.isDemo || ord.id?.startsWith('ord-100')) continue;
            if (ord.shopId === shopId && ord.tokenNumber && ord.createdAt) {
              const ordDate = new Date(ord.createdAt).toLocaleDateString('en-CA');
              if (ordDate === todayStr) {
                const num = parseInt(String(ord.tokenNumber).replace(/\D/g, ''), 10);
                if (!isNaN(num)) usedToday.add(num);
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Check remote orders created TODAY for this shop in database
    if (isSupabaseConfigured) {
      try {
        let canonicalShopId = shopId;
        try {
          const { data: matchedShop } = await supabase
            .from('shops')
            .select('id')
            .or(`id.eq.${shopId},slug.eq.${shopId}`)
            .maybeSingle();
          if (matchedShop?.id) canonicalShopId = matchedShop.id;
        } catch {}

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data: todayOrders } = await supabase
          .from('orders')
          .select('token_number, created_at, is_demo')
          .or(`shop_id.eq.${canonicalShopId},shop_id.eq.${shopId}`)
          .gte('created_at', startOfDay.toISOString());

        if (todayOrders && Array.isArray(todayOrders)) {
          for (const ord of todayOrders) {
            if (ord.is_demo) continue;
            if (ord.token_number) {
              const num = parseInt(String(ord.token_number).replace(/\D/g, ''), 10);
              if (!isNaN(num)) usedToday.add(num);
            }
          }
        }
      } catch {
        // fallback
      }
    }

    // 3.5 Check persistent last token counter for today
    try {
      const lastTokenToday = localStorage.getItem(`foodflow_last_token_${shopId}_${todayStr}`);
      if (lastTokenToday) {
        const lastNum = parseInt(lastTokenToday, 10);
        if (!isNaN(lastNum)) {
          for (let i = 101; i <= lastNum; i++) {
            usedToday.add(i);
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Find the next available token starting at 101
    // Once #101 is taken today, it will NOT be reused today. It continues 102, 103, 104...
    // On the next day, todayStr rolls over, so tokens start fresh from 101!
    let nextToken = 101;
    while (usedToday.has(nextToken)) {
      nextToken += 1;
    }

    // 5. Reserve this token for today
    usedToday.add(nextToken);
    try {
      localStorage.setItem(dailyTokensKey, JSON.stringify(Array.from(usedToday)));
      localStorage.setItem(`foodflow_last_token_${shopId}_${todayStr}`, String(nextToken));
    } catch {
      // ignore
    }

    // Record in remote token_counters if available
    if (isSupabaseConfigured) {
      try {
        await supabase.from('token_counters').upsert({
          shop_id: shopId,
          token_date: todayStr,
          last_token: nextToken,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // fallback
      }
    }

    return nextToken;
  }
}

export const firestoreSync = new SupabaseSyncService();
export const supabaseSync = firestoreSync;
