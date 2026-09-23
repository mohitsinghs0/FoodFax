import React, { useState } from 'react';
import { Order, OrderStatus } from '../../types';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Phone, 
  ChevronRight, 
  Flame, 
  Utensils, 
  IndianRupee, 
  Check, 
  Printer,
  Sparkles
} from 'lucide-react';
import { orderService } from '../../services/orderService';
import { notificationService } from '../../services/notificationService';

interface OrderCardProps {
  order: Order;
  onStatusChange?: (updatedOrder: Order) => void;
  onViewDetails?: (orderId: string) => void;
  compact?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onStatusChange,
  onViewDetails,
  compact = false,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Item currently out of stock');

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            New Order
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
            Accepted
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-100 text-orange-800">
            <Flame className="w-3 h-3 text-orange-600 animate-bounce" />
            Preparing
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Ready for Pickup
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
            Cancelled
          </span>
        );
    }
  };

  const handleAction = async (action: 'ACCEPT' | 'PREPARE' | 'READY' | 'COMPLETE' | 'PAY_CASH') => {
    setLoadingAction(action);
    let updated: Order | null = null;

    try {
      if (action === 'ACCEPT') {
        updated = await orderService.acceptOrder(order.id);
      } else if (action === 'PREPARE') {
        updated = await orderService.startPreparing(order.id);
      } else if (action === 'READY') {
        updated = await orderService.markReady(order.id);
        notificationService.playReadyChime();
        notificationService.sendReadyNotification(order.tokenNumber, order.shopName);
      } else if (action === 'COMPLETE') {
        updated = await orderService.completeOrder(order.id);
      } else if (action === 'PAY_CASH') {
        updated = await orderService.markPaymentPaid(order.id);
      }

      if (updated && onStatusChange) {
        onStatusChange(updated);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRejectConfirm = async () => {
    setLoadingAction('REJECT');
    try {
      const updated = await orderService.rejectOrder(order.id, rejectReason);
      if (updated && onStatusChange) {
        onStatusChange(updated);
      }
      setIsRejectModalOpen(false);
    } finally {
      setLoadingAction(null);
    }
  };

  const formatElapsed = (iso: string) => {
    try {
      const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
      if (diffMin === 0) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      return `${Math.floor(diffMin / 60)}h ago`;
    } catch {
      return 'Today';
    }
  };

  return (
    <div className={`bg-white rounded-2xl border transition-all shadow-xs ${
      order.orderStatus === 'PENDING'
        ? 'border-amber-300 ring-2 ring-amber-100'
        : order.orderStatus === 'READY'
        ? 'border-emerald-300 ring-2 ring-emerald-50'
        : 'border-slate-200 hover:border-slate-300'
    } p-4 sm:p-5 flex flex-col justify-between`}>
      {/* Header: Token Number, Order Type, Time */}
      <div>
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {/* Giant Token Badge */}
            <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-black ${
              order.orderStatus === 'READY'
                ? 'bg-emerald-600 text-white shadow-sm'
                : order.orderStatus === 'PENDING'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-white'
            }`}>
              <span className="text-[10px] uppercase font-bold tracking-wider leading-none opacity-80">TOKEN</span>
              <span className="text-xl tracking-tight leading-tight">{order.tokenNumber}</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  order.orderType === 'DINE_IN' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {order.orderType === 'DINE_IN' ? `Dine In • ${order.tableNumber || 'Table'}` : 'Takeaway'}
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatElapsed(order.createdAt)}
                </span>
              </div>
              <div className="font-bold text-sm text-slate-900 mt-0.5 flex items-center gap-2">
                <span>{order.customerName}</span>
                {order.customerPhone && (
                  <span className="text-xs text-slate-400 font-normal">({order.customerPhone})</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {getStatusBadge(order.orderStatus)}
            {order.paymentStatus === 'PAID' ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Check className="w-3 h-3" />
                PAID {order.paymentMethod === 'PAY_ONLINE' ? 'ONLINE' : 'CASH'}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                COLLECT CASH ₹{order.total}
              </span>
            )}
          </div>
        </div>

        {/* Ordered Items List */}
        <div className="py-3 space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                  item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                </span>
                <span className="font-semibold text-slate-900">
                  <span className="text-orange-600 font-bold mr-1">{item.quantity}×</span>
                  {item.name}
                </span>
              </div>
              <span className="font-semibold text-slate-700 shrink-0">₹{item.price * item.quantity}</span>
            </div>
          ))}

          {/* Customer Special Cooking Instructions / Notes */}
          {order.instructions && (
            <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Note: </span>
                <span>{order.instructions}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Order total, Cash Collection toggle, and Next Status Actions */}
      <div className="pt-3 border-t border-slate-100 mt-2 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Total {order.items.reduce((s, i) => s + i.quantity, 0)} items
          </span>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-slate-900">₹{order.total}</span>
            {order.paymentStatus !== 'PAID' && (
              <button
                onClick={() => handleAction('PAY_CASH')}
                disabled={loadingAction !== null}
                className="text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-md transition-colors"
                title="Mark order as paid in cash"
              >
                Mark Paid
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Status Action Buttons */}
        <div className="flex items-center gap-2">
          {order.orderStatus === 'PENDING' && (
            <>
              <button
                onClick={() => setIsRejectModalOpen(true)}
                disabled={loadingAction !== null}
                className="flex-1 py-2.5 px-3 rounded-xl border border-rose-200 text-rose-700 font-bold text-xs hover:bg-rose-50 transition-colors flex items-center justify-center gap-1"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => handleAction('ACCEPT')}
                disabled={loadingAction !== null}
                className="flex-[2] py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Accept Order</span>
              </button>
            </>
          )}

          {order.orderStatus === 'ACCEPTED' && (
            <button
              onClick={() => handleAction('PREPARE')}
              disabled={loadingAction !== null}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Start Preparing</span>
            </button>
          )}

          {order.orderStatus === 'PREPARING' && (
            <button
              onClick={() => handleAction('READY')}
              disabled={loadingAction !== null}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Ready (Notify Customer)</span>
            </button>
          )}

          {order.orderStatus === 'READY' && (
            <button
              onClick={() => handleAction('COMPLETE')}
              disabled={loadingAction !== null}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Handover & Complete</span>
            </button>
          )}

          {order.orderStatus === 'COMPLETED' && onViewDetails && (
            <button
              onClick={() => onViewDetails(order.id)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
            >
              <span>View Receipt & Details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {order.orderStatus === 'CANCELLED' && (
            <div className="w-full p-2 bg-rose-50 text-rose-800 rounded-lg text-xs">
              <span className="font-bold">Reason: </span>
              <span>{order.cancellationReason || 'Stall cancelled'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Reject Order Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Reject Order {order.tokenNumber}?</h3>
              <p className="text-xs text-slate-500">
                Please select a reason so the customer can be notified accurately.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              {[
                'Item currently out of stock',
                'Stall is facing heavy rush',
                'Shop closing for the day',
                'Customer requested cancellation',
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setRejectReason(reason)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                    rejectReason === reason
                      ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Keep Order
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={loadingAction === 'REJECT'}
                className="py-2.5 px-4 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-xs"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
