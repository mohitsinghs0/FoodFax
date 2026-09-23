import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { orderService } from '../../services/orderService';
import { Order } from '../../types';
import { 
  TrendingUp, 
  IndianRupee, 
  ShoppingBag, 
  CreditCard, 
  Banknote, 
  Award, 
  Calendar,
  Clock 
} from 'lucide-react';

export const BusinessSalesView: React.FC = () => {
  const { currentBusiness, activeShopId } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

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
  }, [targetShopId]);

  const paidOrders = orders.filter(
    (o) => o.orderStatus === 'COMPLETED' || o.paymentStatus === 'PAID'
  );

  const totalRevenue = paidOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const avgOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  const cashOrders = paidOrders.filter((o) => o.paymentMethod === 'CASH_AT_COUNTER');
  const onlineOrders = paidOrders.filter((o) => o.paymentMethod === 'PAY_ONLINE');

  const cashRevenue = cashOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const onlineRevenue = onlineOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Calculate top items
  const itemCounts: { [name: string]: { count: number; revenue: number } } = {};
  paidOrders.forEach((o) => {
    o.items?.forEach((it) => {
      if (!itemCounts[it.name]) itemCounts[it.name] = { count: 0, revenue: 0 };
      itemCounts[it.name].count += it.quantity;
      itemCounts[it.name].revenue += it.price * it.quantity;
    });
  });

  const topItems = Object.entries(itemCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <BusinessLayout activeTab="sales">
      <div className="space-y-6 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Sales & Collection Analytics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track your daily revenue, cash vs UPI, and best-selling dishes
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'today' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'week' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'month' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Key Revenue Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Revenue
            </span>
            <p className="text-3xl font-black text-slate-900 mt-1">₹{totalRevenue}</p>
            <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <span>{paidOrders.length} orders settled</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Avg Order Value (AOV)
            </span>
            <p className="text-3xl font-black text-slate-900 mt-1">₹{avgOrderValue}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Per customer transaction
            </p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Token Inflow
            </span>
            <p className="text-3xl font-black text-slate-900 mt-1">{orders.length}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Tokens generated across counter & tables
            </p>
          </div>
        </div>

        {/* Payment Mode Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Cash at Counter
              </span>
              <span className="font-mono font-bold text-xs text-slate-900">{cashOrders.length} orders</span>
            </div>
            <p className="text-2xl font-black text-slate-900">₹{cashRevenue}</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${totalRevenue > 0 ? (cashRevenue / totalRevenue) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Online UPI Payments
              </span>
              <span className="font-mono font-bold text-xs text-slate-900">{onlineOrders.length} orders</span>
            </div>
            <p className="text-2xl font-black text-slate-900">₹{onlineRevenue}</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${totalRevenue > 0 ? (onlineRevenue / totalRevenue) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top Selling Dishes */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
          <h2 className="font-black text-base text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Top Selling Dishes
          </h2>

          {topItems.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {topItems.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-slate-900">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 font-bold text-xs">
                      {item.count} sold
                    </span>
                    <span className="font-black text-xs sm:text-sm text-slate-900 w-20 text-right">
                      ₹{item.revenue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">
              No sales data recorded yet. Settle orders to see popular dishes!
            </p>
          )}
        </div>
      </div>
    </BusinessLayout>
  );
};
