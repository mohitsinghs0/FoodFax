import { Order } from '../types';
import { orderService } from './orderService';
import { firestoreSync } from './firestoreSyncService';

type OrderEventCallback = (order: Order) => void;
type OrdersListCallback = (orders: Order[]) => void;

/**
 * Real-time event bus backed by Supabase Realtime (PostgreSQL postgres_changes)
 * with localStorage cross-tab events as a local fallback.
 *
 * NOTE: `firestoreSyncService` is a legacy name — the service uses Supabase, not Firebase Firestore.
 */
class OrderRealtimeService {
  private isConnected: boolean = true;
  private connectionListeners = new Set<(status: boolean) => void>();

  public subscribeToShop(shopId: string, onOrdersUpdate: OrdersListCallback): () => void {
    // 1. Subscribe to in-memory local pub/sub (immediate, no network)
    const unsubscribeOrderService = orderService.subscribeToShopOrders(shopId, onOrdersUpdate);

    // 2. Subscribe to Supabase Realtime postgres_changes for the orders table
    const unsubscribeSupabase = firestoreSync.subscribeToShopOrders(shopId, (cloudOrders) => {
      // Merge remote updates with local cache
      const current = orderService.getStoredOrders();
      const map = new Map<string, Order>();
      current.forEach((o) => map.set(o.id, o));
      cloudOrders.forEach((o) => map.set(o.id, o));
      const merged = Array.from(map.values());
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      orderService.saveOrders(merged);
      orderService.getShopOrders(shopId).then((shopOrders) => {
        onOrdersUpdate(shopOrders);
      });
    });

    // 3. Cross-tab synchronisation via window storage events
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'foodflow_customer_orders') {
        orderService.getShopOrders(shopId).then((orders) => {
          onOrdersUpdate(orders);
        });
      }
    };

    window.addEventListener('storage', storageHandler);

    return () => {
      unsubscribeOrderService();
      unsubscribeSupabase();
      window.removeEventListener('storage', storageHandler);
    };
  }

  public subscribeToShopOrders(shopId: string, onOrdersUpdate: OrdersListCallback): () => void {
    return this.subscribeToShop(shopId, onOrdersUpdate);
  }

  public subscribeToOrder(orderId: string, onOrderUpdate: OrderEventCallback): () => void {
    const unsubLocal = orderService.subscribeToOrder(orderId, onOrderUpdate);
    const unsubSupabase = firestoreSync.subscribeToSingleOrder(orderId, (order) => {
      // Sync the remote update into localStorage cache
      const current = orderService.getStoredOrders();
      const idx = current.findIndex((o) => o.id === order.id);
      if (idx !== -1) {
        current[idx] = order;
      } else {
        current.unshift(order);
      }
      orderService.saveOrders(current);
      onOrderUpdate(order);
    });

    return () => {
      unsubLocal();
      unsubSupabase();
    };
  }

  public subscribeToCustomer(customerId: string | undefined, onOrdersUpdate: OrdersListCallback): () => void {
    const check = () => {
      orderService.getCustomerOrders(customerId).then(onOrdersUpdate);
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'foodflow_customer_orders') {
        check();
      }
    };
    window.addEventListener('storage', storageHandler);
    const interval = setInterval(check, 3500);
    return () => {
      window.removeEventListener('storage', storageHandler);
      clearInterval(interval);
    };
  }

  public setConnectionStatus(online: boolean): void {
    this.isConnected = online;
    this.connectionListeners.forEach((fn) => fn(online));
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public onConnectionChange(listener: (status: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  public async simulateIncomingOrder(shopId: string = 'sharma-vada-pav'): Promise<Order> {
    return orderService.simulateIncomingOrder(shopId);
  }
}

export const orderRealtimeService = new OrderRealtimeService();

