import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { OrderCard } from '../../components/business/OrderCard';
import { BusinessPerformanceDashboard } from '../../components/business/BusinessPerformanceDashboard';
import { orderService } from '../../services/orderService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { notificationService } from '../../services/notificationService';
import { shopService } from '../../services/shopService';
import { Order, OrderStatus, ShopReview } from '../../types';
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
  AlertCircle,
  Star,
  Store,
  MessageSquare,
  BarChart3
} from 'lucide-react';

export const BusinessDashboardView: React.FC = () => {
  const { route, navigate } = useRouter();
  const { currentBusiness, activeShopId, currentUser } = useAuth();
  const storedOwnerShop = !activeShopId && !currentBusiness?.id && !currentUser?.shopId && currentUser
    ? shopService.getStoredShops().find((s: any) => s.ownerId === currentUser.id)
    : null;
  const targetShopId = activeShopId || currentBusiness?.id || currentUser?.shopId || storedOwnerShop?.id || '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [stallRemoved, setStallRemoved] = useState(false);
  const [filter, setFilter] = useState<'active' | 'ready' | 'all'>('active');
  const [activeDashboardTab, setActiveDashboardTab] = useState<'queue' | 'performance' | 'reviews'>(() => {
    return (route.params?.tab as any) === 'performance' ? 'performance' : 'queue';
  });

  // Sync tab with URL param if route changes
  useEffect(() => {
    if (route.params?.tab === 'performance') {
      setActiveDashboardTab('performance');
    } else if (route.params?.tab === 'reviews') {
      setActiveDashboardTab('reviews');
    }
  }, [route.params?.tab]);

  const loadData = async () => {
    if (!targetShopId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Validate that this stall still exists in the live database
      const liveShop = await shopService.getShop(targetShopId);
      if (!liveShop) {
        setStallRemoved(true);
        setOrders([]);
        setLoading(false);
        return;
      }
      setStallRemoved(false);

      const [shopOrders, shopReviews] = await Promise.all([
        orderService.getShopOrders(targetShopId),
        Promise.resolve(shopService.getShopReviews(targetShopId)),
      ]);
      setOrders(shopOrders);
      setReviews(shopReviews);
    } catch (err) {
      console.error('Failed to load shop dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!targetShopId) return;

    // Subscribe to live shop orders updates
    const unsubscribeOrders = orderRealtimeService.subscribeToShopOrders(targetShopId, (updated) => {
      setOrders(updated);
      setReviews(shopService.getShopReviews(targetShopId));
    });

    // Subscribe to shops list changes: if this stall is removed from database, remove it from UI dashboard
    const unsubscribeShops = shopService.subscribeToShops((liveShops) => {
      const stillExists = liveShops.some(
        (s) => s.id === targetShopId || s.slug === targetShopId
      );
      if (!stillExists) {
        setStallRemoved(true);
        setOrders([]);
      }
    });

    return () => {
      unsubscribeOrders();
      unsubscribeShops();
    };
  }, [targetShopId]);

  if (!targetShopId || stallRemoved) {
    return (
      <BusinessLayout activeTab="dashboard">
        <div className="py-16 px-4 max-w-lg mx-auto text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-sm">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">
            {stallRemoved ? 'Food Stall Removed' : 'Set Up Your Food Stall'}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {stallRemoved
              ? 'This food stall is no longer available in the database. You can register a new stall counter to start managing your kitchen queue and calling orders.'
              : 'You are logged in as a Stall Owner, but haven\'t registered your food stall counter yet. Set up your stall profile to start creating menu items and receiving live customer counter tokens!'}
          </p>
          <button
            onClick={() => navigate('/setup-shop')}
            className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition-all flex items-center gap-2 mx-auto"
          >
            <Store className="w-4 h-4" />
            <span>Register Stall Counter</span>
          </button>
        </div>
      </BusinessLayout>
    );
  }

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

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0';

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
            onClick={() => setActiveDashboardTab('performance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeDashboardTab === 'performance'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Performance Charts</span>
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
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sales Report</span>
          </button>
          <button
            onClick={loadData}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 whitespace-nowrap transition-colors ml-auto"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Main Dashboard Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveDashboardTab('queue')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeDashboardTab === 'queue'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-orange-500" />
            <span>Kitchen Queue</span>
            {activeOrders.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white">
                {activeOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDashboardTab('performance')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeDashboardTab === 'performance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Business Performance</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Daily Trends & Rush Hours
            </span>
          </button>

          <button
            onClick={() => setActiveDashboardTab('reviews')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeDashboardTab === 'reviews'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Customer Reviews</span>
            {reviews.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                {reviews.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: BUSINESS PERFORMANCE (Recharts Daily Trends & Rush Hours) */}
        {activeDashboardTab === 'performance' && (
          <BusinessPerformanceDashboard 
            orders={orders} 
            shopId={targetShopId} 
            shopName={currentBusiness?.name || storedOwnerShop?.name || 'Sharma Vada Pav'} 
          />
        )}

        {/* TAB 2: ORDERS QUEUE SECTION */}
        {activeDashboardTab === 'queue' && (
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
        )}

        {/* TAB 3: CUSTOMER FEEDBACK & REVIEWS SECTION */}
        {activeDashboardTab === 'reviews' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Customer Feedback & Reviews</h3>
                <p className="text-xs text-slate-500">Live post-order ratings from customers who collected food</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span className="font-extrabold text-sm text-slate-900">{averageRating}</span>
              <span className="text-[11px] text-slate-500">({reviews.length} reviews)</span>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/70 rounded-xl border border-slate-100">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-700">No customer reviews yet</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                When customers complete orders and collect their food, their star ratings and feedback will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{rev.customerName || 'Customer'}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${
                            s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {rev.feedbackTags && rev.feedbackTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rev.feedbackTags.map((tag) => (
                        <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-200/60 shadow-2xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {rev.reviewText && (
                    <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                      "{rev.reviewText}"
                    </p>
                  )}
                  <span className="text-[10px] text-slate-400 block">
                    {new Date(rev.createdAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </BusinessLayout>
  );
};
