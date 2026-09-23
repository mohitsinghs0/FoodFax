import { Order, OrderStatus } from '../types';
import { INITIAL_ORDERS } from '../data/mockData';
import { firestoreSync, normalizeOrderDoc, onDatabaseOrderCommitted } from './firestoreSyncService';
import { notificationService } from './notificationService';
import { assertValidOrderSubmission } from '../utils/orderValidation';

const ORDERS_STORAGE_KEY = 'foodflow_customer_orders';
const ORDER_LISTENERS_MAP = new Map<string, Set<(order: Order) => void>>();
const SHOP_ORDER_LISTENERS = new Map<string, Set<(orders: Order[]) => void>>();
const ORDER_COMMIT_LISTENERS = new Set<(order: Order) => void>();

// Forward any direct firestore commits to order commit listeners
onDatabaseOrderCommitted((order) => {
  ORDER_COMMIT_LISTENERS.forEach((listener) => {
    try {
      listener(order);
    } catch (err) {
      console.error('[orderService] Error in database order commit listener:', err);
    }
  });
});

export const MOCK_ORDER_IDS = new Set<string>([
  'ord-1001',
  'ord-1002',
  'ord-1003',
  'ord-1004',
  'ord-1005',
]);

export const orderService = {
  isDemoCustomerCheck(customerId?: string): boolean {
    if (customerId === 'demo-customer-001') return true;
    try {
      const stored = localStorage.getItem('foodflow_auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.isDemo || u.id === 'demo-customer-001') {
          return true;
        }
      }
    } catch {
      // fallback
    }
    return false;
  },

  getStoredOrders(): Order[] {
    try {
      const stored = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return [];
  },

  saveOrders(orders: Order[]): void {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // fallback
    }
  },

  async getCustomerOrders(customerId?: string): Promise<Order[]> {
    await new Promise((r) => setTimeout(r, 40));
    const isDemo = this.isDemoCustomerCheck(customerId);

    if (isDemo) {
      // Demo customer view: returns INITIAL_ORDERS for demo simulation
      const local = this.getStoredOrders();
      if (local.length > 0) return local;
      return INITIAL_ORDERS;
    }

    // Determine current user ID if not provided
    let effectiveCustomerId = customerId;
    if (!effectiveCustomerId) {
      try {
        const stored = localStorage.getItem('foodflow_auth_user');
        if (stored) {
          const u = JSON.parse(stored);
          effectiveCustomerId = u.id;
        }
      } catch {
        // fallback
      }
    }

    if (!effectiveCustomerId) {
      // Guest with no account has placed 0 orders: return empty list
      return [];
    }

    // Real user mode: fetch from Firestore & merge with local non-demo orders
    let remoteOrders: Order[] = [];
    try {
      remoteOrders = await firestoreSync.getOrdersByCustomer(effectiveCustomerId);
    } catch {
      // fallback
    }

    const localOrders = this.getStoredOrders().filter(
      (o) => o.customerId === effectiveCustomerId && !o.isDemo && !MOCK_ORDER_IDS.has(o.id)
    );

    const orderMap = new Map<string, Order>();
    localOrders.forEach((o) => orderMap.set(o.id, o));
    remoteOrders.forEach((o) => {
      if (!o.isDemo && !MOCK_ORDER_IDS.has(o.id)) {
        orderMap.set(o.id, o);
      }
    });

    const combined = Array.from(orderMap.values()).map((order) => normalizeOrderDoc(order));
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
  },

  async getShopOrders(shopId: string): Promise<Order[]> {
    await new Promise((r) => setTimeout(r, 30));

    // Determine if current owner is demo owner
    let isDemoOwner = false;
    try {
      const stored = localStorage.getItem('foodflow_auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.id === 'demo-owner-001' && u.isDemo) {
          isDemoOwner = true;
        }
      }
    } catch {
      // fallback
    }

    // Demo owner viewing Sharma Vada Pav gets the demo simulation orders
    if (shopId === 'sharma-vada-pav' && isDemoOwner) {
      const local = this.getStoredOrders().filter((o) => o.shopId === shopId);
      if (local.length > 0) return local;
      return INITIAL_ORDERS.filter((o) => o.shopId === shopId);
    }

    // For any real/new shop (like shop-411159) OR when logged in as a real owner:
    // Fetch live orders from Firestore and merge with local real orders!
    let remoteOrders: Order[] = [];
    try {
      remoteOrders = await firestoreSync.getOrdersByShop(shopId);
    } catch {
      // fallback
    }

    const localOrders = this.getStoredOrders().filter(
      (o) => o.shopId === shopId && !o.isDemo && !MOCK_ORDER_IDS.has(o.id)
    );

    const orderMap = new Map<string, Order>();
    localOrders.forEach((o) => orderMap.set(o.id, o));
    remoteOrders.forEach((o) => {
      if (!o.isDemo && !MOCK_ORDER_IDS.has(o.id)) {
        orderMap.set(o.id, o);
      }
    });

    const combined = Array.from(orderMap.values()).map((order) => normalizeOrderDoc(order));
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
  },

  async getActiveOrders(shopId: string): Promise<Order[]> {
    const all = await this.getShopOrders(shopId);
    return all.filter(
      (o) =>
        o.orderStatus === 'PENDING' ||
        o.orderStatus === 'ACCEPTED' ||
        o.orderStatus === 'PREPARING' ||
        o.orderStatus === 'READY'
    );
  },

  async getOrderHistory(shopId: string, filter: 'TODAY' | 'YESTERDAY' | 'ALL' = 'TODAY'): Promise<Order[]> {
    const all = await this.getShopOrders(shopId);
    return all.filter((o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'CANCELLED');
  },

  async getOrder(orderId: string): Promise<Order | null> {
    await new Promise((r) => setTimeout(r, 30));
    const orders = this.getStoredOrders();
    return orders.find((o) => o.id === orderId) || null;
  },

  async acceptOrder(orderId: string): Promise<Order | null> {
    return this.updateOrderStatus(orderId, 'ACCEPTED');
  },

  async startPreparing(orderId: string): Promise<Order | null> {
    return this.updateOrderStatus(orderId, 'PREPARING');
  },

  async markReady(orderId: string): Promise<Order | null> {
    return this.updateOrderStatus(orderId, 'READY');
  },

  async completeOrder(orderId: string): Promise<Order | null> {
    return this.updateOrderStatus(orderId, 'COMPLETED');
  },

  async rejectOrder(orderId: string, reason?: string): Promise<Order | null> {
    return this.cancelOrder(orderId, reason || 'Item unavailable or stall closed', 'owner');
  },

  async cancelOrder(
    orderId: string, 
    reason: string = 'Cancelled by customer', 
    cancelledBy: 'customer' | 'owner' | 'system' = 'customer'
  ): Promise<Order | null> {
    const orders = this.getStoredOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    let targetOrder: Order | null = null;
    const now = new Date().toISOString();

    if (index !== -1) {
      targetOrder = {
        ...orders[index],
        orderStatus: 'CANCELLED' as OrderStatus,
        cancellationReason: reason,
        cancelledAt: now,
        cancelledBy,
        updatedAt: now,
      };
      orders[index] = targetOrder;
      this.saveOrders(orders);
    } else {
      const remote = await firestoreSync.getOrder(orderId);
      if (remote) {
        targetOrder = {
          ...remote,
          orderStatus: 'CANCELLED' as OrderStatus,
          cancellationReason: reason,
          cancelledAt: now,
          cancelledBy,
          updatedAt: now,
        };
        this.saveOrders([targetOrder, ...orders]);
      }
    }

    if (!targetOrder) return null;

    this.notifyOrderListeners(targetOrder);
    this.notifyShopListeners(targetOrder.shopId);

    // Update in Firestore
    try {
      await firestoreSync.updateOrderStatus(
        orderId, 
        'CANCELLED', 
        {
          cancellationReason: reason,
          cancelledAt: now,
          cancelledBy,
        },
        cancelledBy,
        `Order cancelled by ${cancelledBy}: ${reason}`
      );
    } catch (err) {
      console.warn('[orderService] Failed to sync order cancellation to Firestore:', err);
    }

    // Trigger real-time notification for the specific shop owner
    try {
      await notificationService.addNotification({
        shopId: targetOrder.shopId,
        title: cancelledBy === 'customer' ? 'Order Cancelled by Customer' : 'Order Cancelled',
        message: `Token ${targetOrder.tokenNumber} was cancelled: "${reason}". Total ₹${targetOrder.total}`,
        type: 'ORDER_CANCELLED',
        tokenNumber: targetOrder.tokenNumber,
        orderId: targetOrder.id,
        amount: targetOrder.total,
      });
    } catch (err) {
      console.warn('[orderService] Failed to dispatch cancellation notification:', err);
    }

    return targetOrder;
  },

  async submitOrderReview(
    orderId: string,
    rating: number,
    reviewText: string,
    feedbackTags: string[] = []
  ): Promise<Order | null> {
    const orders = this.getStoredOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    const now = new Date().toISOString();
    let updatedOrder: Order | null = null;

    if (index !== -1) {
      updatedOrder = {
        ...orders[index],
        rating,
        reviewText,
        feedbackTags,
        reviewedAt: now,
        updatedAt: now,
      };
      orders[index] = updatedOrder;
      this.saveOrders(orders);
    } else {
      const remote = await firestoreSync.getOrder(orderId);
      if (remote) {
        updatedOrder = {
          ...remote,
          rating,
          reviewText,
          feedbackTags,
          reviewedAt: now,
          updatedAt: now,
        };
        this.saveOrders([updatedOrder, ...orders]);
      }
    }

    if (!updatedOrder) return null;

    this.notifyOrderListeners(updatedOrder);
    this.notifyShopListeners(updatedOrder.shopId);

    try {
      await firestoreSync.saveOrderReview(orderId, rating, reviewText, feedbackTags);
    } catch (err) {
      console.warn('[orderService] Failed to sync review to Firestore:', err);
    }

    return updatedOrder;
  },

  async markPaymentPaid(orderId: string): Promise<Order | null> {
    const orders = this.getStoredOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return null;

    const order = {
      ...orders[index],
      paymentStatus: 'PAID' as const,
      updatedAt: new Date().toISOString(),
    };
    orders[index] = order;
    this.saveOrders(orders);
    this.notifyOrderListeners(order);
    this.notifyShopListeners(order.shopId);
    return order;
  },

  async createOrder(data: {
    shopId: string;
    shopName: string;
    shopImage?: string;
    shopLocation: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    orderType: 'TAKEAWAY' | 'DINE_IN';
    tableNumber?: string;
    paymentMethod: 'CASH_AT_COUNTER' | 'PAY_ONLINE';
    items: {
      id: string;
      menuItemId: string;
      name: string;
      price: number;
      quantity: number;
      isVeg: boolean;
    }[];
    subtotal: number;
    total: number;
    estimatedPreparationMinutes: string;
    instructions?: string;
  }): Promise<Order> {
    await new Promise((r) => setTimeout(r, 60));
    const orders = this.getStoredOrders();

    // 1. Validation helper: verify total_amount matches sum(order_items.subtotal)
    assertValidOrderSubmission({
      items: data.items,
      total: data.total,
    });

    // 2. Generate unique, shop-specific daily token using transactional atomic generator
    const tokenInt = await firestoreSync.generateOrderToken(data.shopId);
    const tokenNumber = `#${tokenInt}`;

    const newOrder: Order = {
      id: `ord-${Date.now().toString().slice(-6)}`,
      shopId: data.shopId,
      shopName: data.shopName,
      shopImage: data.shopImage,
      shopLocation: data.shopLocation,
      customerId: data.customerId || 'cust-user',
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || '+91 98765 43210',
      tokenNumber,
      orderType: data.orderType,
      tableNumber: data.tableNumber,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentMethod === 'PAY_ONLINE' ? 'PAID' : 'COLLECT_ON_DELIVERY',
      orderStatus: 'PENDING',
      items: data.items,
      subtotal: data.subtotal,
      total: data.total,
      estimatedPreparationMinutes: data.estimatedPreparationMinutes,
      createdAt: new Date().toISOString(),
      instructions: data.instructions,
      isDemo: false,
    };

    const updated = [newOrder, ...orders];
    this.saveOrders(updated);
    this.notifyOrderListeners(newOrder);
    this.notifyShopListeners(data.shopId);
    await firestoreSync.saveOrder(newOrder);
    this.notifyOrderCommitted(newOrder);

    return newOrder;
  },

  async simulateIncomingOrder(shopId: string = 'sharma-vada-pav'): Promise<Order> {
    const orders = this.getStoredOrders();
    const tokenInt = await firestoreSync.generateOrderToken(shopId);
    const tokenNumber = `#${tokenInt}`;

    const sampleSets = [
      {
        items: [
          { id: `it-${Date.now()}-1`, menuItemId: 'svp-1', name: 'Classic Mumbai Vada Pav', price: 20, quantity: 3, isVeg: true },
          { id: `it-${Date.now()}-2`, menuItemId: 'svp-8', name: 'Special Cutting Chai', price: 15, quantity: 2, isVeg: true },
        ],
        type: 'TAKEAWAY' as const,
        customerName: 'Aman Patel',
        phone: '+91 98921 44556',
        notes: 'Make it extra spicy with fried chillies!',
      },
      {
        items: [
          { id: `it-${Date.now()}-1`, menuItemId: 'svp-2', name: 'Cheese Burst Vada Pav', price: 35, quantity: 2, isVeg: true },
          { id: `it-${Date.now()}-2`, menuItemId: 'svp-10', name: 'Fresh Lime Soda', price: 30, quantity: 1, isVeg: true },
        ],
        type: 'DINE_IN' as const,
        tableNumber: 'Table 5',
        customerName: 'Kavita Roy',
        phone: '+91 98334 55667',
        notes: 'Less sweet in lime soda please',
      },
    ];

    const pick = sampleSets[Math.floor(Math.random() * sampleSets.length)];
    const subtotal = pick.items.reduce((s, i) => s + i.price * i.quantity, 0);

    const newOrder: Order = {
      id: `ord-${Date.now().toString().slice(-6)}`,
      shopId,
      shopName: 'Sharma Vada Pav',
      shopLocation: 'Gate 2, Andheri West Metro',
      customerId: `cust-${Date.now()}`,
      customerName: pick.customerName,
      customerPhone: pick.phone,
      tokenNumber,
      orderType: pick.type,
      tableNumber: pick.tableNumber,
      paymentMethod: pick.type === 'DINE_IN' ? 'PAY_ONLINE' : 'CASH_AT_COUNTER',
      paymentStatus: pick.type === 'DINE_IN' ? 'PAID' : 'COLLECT_ON_DELIVERY',
      orderStatus: 'PENDING',
      items: pick.items,
      subtotal,
      total: subtotal,
      estimatedPreparationMinutes: '5',
      createdAt: new Date().toISOString(),
      instructions: pick.notes,
      isDemo: true,
    };

    // Assert validation
    assertValidOrderSubmission(newOrder);

    const updated = [newOrder, ...orders];
    this.saveOrders(updated);
    this.notifyOrderListeners(newOrder);
    this.notifyShopListeners(shopId);
    await firestoreSync.saveOrder(newOrder);

    return newOrder;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
    const orders = this.getStoredOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return null;

    const order = { ...orders[index], orderStatus: status, updatedAt: new Date().toISOString() };
    if (status === 'READY') {
      order.readyAt = new Date().toISOString();
    } else if (status === 'COMPLETED') {
      order.completedAt = new Date().toISOString();
    }

    orders[index] = order;
    this.saveOrders(orders);
    this.notifyOrderListeners(order);
    this.notifyShopListeners(order.shopId);
    firestoreSync.updateOrderStatus(orderId, status, {
      readyAt: order.readyAt,
      completedAt: order.completedAt,
    });

    return order;
  },

  subscribeToOrder(orderId: string, listener: (order: Order) => void): () => void {
    if (!ORDER_LISTENERS_MAP.has(orderId)) {
      ORDER_LISTENERS_MAP.set(orderId, new Set());
    }
    ORDER_LISTENERS_MAP.get(orderId)!.add(listener);

    return () => {
      const set = ORDER_LISTENERS_MAP.get(orderId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          ORDER_LISTENERS_MAP.delete(orderId);
        }
      }
    };
  },

  subscribeToShopOrders(shopId: string, listener: (orders: Order[]) => void): () => void {
    if (!SHOP_ORDER_LISTENERS.has(shopId)) {
      SHOP_ORDER_LISTENERS.set(shopId, new Set());
    }
    SHOP_ORDER_LISTENERS.get(shopId)!.add(listener);

    return () => {
      const set = SHOP_ORDER_LISTENERS.get(shopId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          SHOP_ORDER_LISTENERS.delete(shopId);
        }
      }
    };
  },

  notifyOrderListeners(order: Order): void {
    const listeners = ORDER_LISTENERS_MAP.get(order.id);
    if (listeners) {
      listeners.forEach((listener) => listener(order));
    }
  },

  async notifyShopListeners(shopId: string): Promise<void> {
    const listeners = SHOP_ORDER_LISTENERS.get(shopId);
    if (listeners) {
      const all = await this.getShopOrders(shopId);
      listeners.forEach((listener) => listener(all));
    }
  },

  onOrderCommitted(listener: (order: Order) => void): () => void {
    ORDER_COMMIT_LISTENERS.add(listener);
    return () => {
      ORDER_COMMIT_LISTENERS.delete(listener);
    };
  },

  notifyOrderCommitted(order: Order): void {
    ORDER_COMMIT_LISTENERS.forEach((listener) => {
      try {
        listener(order);
      } catch (err) {
        console.error('[orderService] Error in order commit listener:', err);
      }
    });
  },
};

