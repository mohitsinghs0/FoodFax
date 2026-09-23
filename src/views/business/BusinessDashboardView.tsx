import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { OrderCard } from '../../components/business/OrderCard';
import { orderService } from '../../services/orderService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { notificationService } from '../../services/notificationService';
import { Order, OrderStatus } from '../../types';
import { 
  ShoppingBag, 
  IndianRupee, 
  Clock, 
  Flame, 
  CheckCircle2, 
  Zap, 
  Plus, 
  QrCode, 
  TrendingUp, 
  Volume2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const BusinessDashboardView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentBusiness, activeShopId } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'ready' | 'all'>('active');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const shopOrders = await orderService.getShopOrders(targetShopId);
      setOrders(shopOrders);
    } catch (err) {
      console.error('Failed to load shop orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Subscribe to live shop orders updates
    const unsubscribe = orderRealtimeService.subscribeToShopOrders(targetShopId, (updated) => {
      setOrders(updated);
    });

    return () => unsubscribe();
  }, [targetShopId]);

  const activeOrders = orders.filter((o) =>
    ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.orderStatus)
  );

  const readyOrders = orders.filter((o) => o.orderStatus === 'READY');
  const pendingOrders = orders.filter((o) => o.orderStatus === 'PENDING');
  const preparingOrders = orders.filter((o) => o.orderStatus === 'PREPARING');
  const completedOrders = orders.filter((o) => o.orderStatus === 'COMPLETED');

  const todayRevenue = orders
    .filter((o) => o.orderStatus === 'COMPLETED' || o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const displayedOrders =
    filter === 'ready'
      ? readyOrders
      : filter === 'all'
      ? orders
      : activeOrders;

  const handleStatusChange = (updatedOrder: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
  };

  return (
    <BusinessLayout activeTab="dashboard">
      <div className="space-y-6 pb-20">
        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold">Active Tokens</span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-black text-slate-900">{activeOrders.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">In kitchen queue</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold">Ready to Call</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-600">{readyOrders.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting pickup</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold">Completed</span>
              <ShoppingBag className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black text-slate-900">{completedOrders.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Fulfilled today</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold">Today&apos;s Sales</span>
              <IndianRupee className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-900">₹{todayRevenue}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Total collection</p>
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => navigate('/business/menu/new')}
            className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dish</span>
          </button>
          <button
            onClick={() => navigate('/business/qr')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>Counter QR Poster</span>
          </button>
          <button
            onClick={() => navigate('/business/sales')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sales Report</span>
          </button>
          <button
            onClick={loadOrders}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 whitespace-nowrap transition-colors ml-auto"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Orders Queue Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Live Kitchen Token Queue ({activeOrders.length})
            </h2>

            {/* Filter Pills */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setFilter('active')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filter === 'active' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Active ({activeOrders.length})
              </button>
              <button
                onClick={() => setFilter('ready')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filter === 'ready' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Ready ({readyOrders.length})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All ({orders.length})
              </button>
            </div>
          </div>

          {loading && orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80">
              <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">Syncing live kitchen tokens...</p>
            </div>
          ) : displayedOrders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {displayedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                  onViewDetails={(id) => navigate(`/business/orders/${id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-sm mb-1">Queue is clear</h3>
              <p className="text-xs text-slate-500">
                No active orders at the moment. New token requests will chime here in real time!
              </p>
            </div>
          )}
        </div>
      </div>
    </BusinessLayout>
  );
};
