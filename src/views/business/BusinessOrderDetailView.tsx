import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { orderService } from '../../services/orderService';
import { notificationService } from '../../services/notificationService';
import { Order, OrderStatus } from '../../types';
import { VegBadge } from '../../components/common/VegBadge';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  Flame, 
  Printer, 
  Phone, 
  ShoppingBag, 
  IndianRupee, 
  Check, 
  X, 
  AlertCircle 
} from 'lucide-react';

export const BusinessOrderDetailView: React.FC = () => {
  const { route, navigate, goBack } = useRouter();
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const found = await orderService.getOrder(orderId);
        setOrder(found);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    setUpdating(true);
    try {
      const updated = await orderService.updateOrderStatus(order.id, newStatus);
      if (updated) {
        setOrder(updated);
        notificationService.playChime('order_status');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <BusinessLayout activeTab="orders" showBackButton onBack={goBack}>
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium">Loading token details...</p>
        </div>
      </BusinessLayout>
    );
  }

  if (!order) {
    return (
      <BusinessLayout activeTab="orders" showBackButton onBack={goBack}>
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-slate-900 mb-1">Order Not Found</h2>
          <button
            onClick={() => navigate('/business/orders')}
            className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold"
          >
            Back to Orders
          </button>
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout activeTab="orders" showBackButton onBack={goBack}>
      <div className="max-w-2xl mx-auto space-y-5 pb-20">
        {/* Token Header Banner */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-500 text-white flex flex-col items-center justify-center font-black shadow-md shadow-orange-500/20">
              <span className="text-[10px] uppercase opacity-80">Token</span>
              <span className="text-xl font-mono">{order.tokenNumber}</span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-900">
                  {order.customerName}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">
                  {order.orderType === 'DINE_IN' ? `Dine-In (${order.tableNumber || 'Table'})` : 'Takeaway'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Placed at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>•</span>
                <span className="font-bold text-slate-700">₹{order.total}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Print Order KOT"
            >
              <Printer className="w-4 h-4" />
            </button>
            {order.customerPhone && (
              <a
                href={`tel:${order.customerPhone}`}
                className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
                title="Call Customer"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Status Transition Action Bar */}
        <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Current Stage
            </span>
            <span className="text-sm font-extrabold text-orange-400">
              {order.orderStatus}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {order.orderStatus === 'PENDING' && (
              <button
                onClick={() => handleUpdateStatus('ACCEPTED')}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-xs"
              >
                Accept Order
              </button>
            )}

            {order.orderStatus === 'ACCEPTED' && (
              <button
                onClick={() => handleUpdateStatus('PREPARING')}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5" />
                Start Preparing
              </button>
            )}

            {order.orderStatus === 'PREPARING' && (
              <button
                onClick={() => handleUpdateStatus('READY')}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Call Token (Mark Ready)
              </button>
            )}

            {order.orderStatus === 'READY' && (
              <button
                onClick={() => handleUpdateStatus('COMPLETED')}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Hand Over & Complete
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        {order.instructions && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950">
            <span className="text-[11px] font-black uppercase tracking-wider block mb-1">
              Customer Note / Special Instructions
            </span>
            <p className="text-xs font-medium">&ldquo;{order.instructions}&rdquo;</p>
          </div>
        )}

        {/* Order Items Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">Ordered Dishes</h2>
            <span className="text-xs text-slate-500">{order.items.length} items</span>
          </div>

          <div className="divide-y divide-slate-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <VegBadge isVeg={item.isVeg} size="sm" />
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{item.name}</h3>
                    <p className="text-[11px] text-slate-400">₹{item.price} each</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-xs text-slate-700">
                    x{item.quantity}
                  </span>
                  <span className="font-bold text-xs text-slate-900 w-16 text-right">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-900">
            <span>Total Bill</span>
            <span className="text-sm text-orange-600">₹{order.total}</span>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
};
