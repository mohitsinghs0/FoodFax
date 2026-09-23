import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { OrderCard } from '../../components/business/OrderCard';
import { orderService } from '../../services/orderService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { Order } from '../../types';
import { ShoppingBag, Search, Filter, Clock, CheckCircle2, ChevronRight, Utensils } from 'lucide-react';

export const BusinessOrdersView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentBusiness, activeShopId } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'queue' | 'history'>('queue');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY'>('ALL');
  const [searchToken, setSearchToken] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const o = await orderService.getShopOrders(targetShopId);
        setOrders(o);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();

    const unsub = orderRealtimeService.subscribeToShopOrders(targetShopId, (updated) => {
      setOrders(updated);
    });

    return () => unsub();
  }, [targetShopId]);

  const activeStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'];

  const filteredOrders = orders.filter((o) => {
    const isQueue = activeStatuses.includes(o.orderStatus);
    const matchesTab = tab === 'queue' ? isQueue : !isQueue;
    const matchesType = orderTypeFilter === 'ALL' || o.orderType === orderTypeFilter;
    const matchesSearch =
      !searchToken ||
      String(o.tokenNumber || '').toLowerCase().includes(searchToken.toLowerCase()) ||
      String(o.customerName || '').toLowerCase().includes(searchToken.toLowerCase()) ||
      String(o.tableNumber || '').toLowerCase().includes(searchToken.toLowerCase());

    return matchesTab && matchesType && matchesSearch;
  });

  const handleStatusChange = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  return (
    <BusinessLayout activeTab="orders">
      <div className="space-y-5 pb-20">
        {/* Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setTab('queue')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === 'queue' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Queue ({orders.filter((o) => activeStatuses.includes(o.orderStatus)).length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed & History ({orders.filter((o) => !activeStatuses.includes(o.orderStatus)).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchToken}
                onChange={(e) => setSearchToken(e.target.value)}
                placeholder="Search token # or name..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">All Types</option>
              <option value="TAKEAWAY">Takeaway</option>
              <option value="DINE_IN">Dine-In</option>
            </select>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading orders...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {filteredOrders.map((order) => (
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
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">
              No orders found matching this filter.
            </p>
          </div>
        )}
      </div>
    </BusinessLayout>
  );
};
