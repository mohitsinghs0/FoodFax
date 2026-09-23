import React, { useState } from 'react';
import { Order } from '../../types';
import { Zap, X, Volume2, VolumeX, CheckCircle2, Flame, Check, AlertCircle } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { notificationService } from '../../services/notificationService';

interface RushModeViewProps {
  orders: Order[];
  onClose: () => void;
  onRefresh: () => void;
}

export const RushModeView: React.FC<RushModeViewProps> = ({ orders, onClose, onRefresh }) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY'>('ALL');
  const [sound, setSound] = useState(true);

  const activeOrders = orders.filter(
    (o) =>
      o.orderStatus === 'PENDING' ||
      o.orderStatus === 'ACCEPTED' ||
      o.orderStatus === 'PREPARING' ||
      o.orderStatus === 'READY'
  );

  const filteredOrders = activeOrders.filter((o) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return o.orderStatus === 'PENDING' || o.orderStatus === 'ACCEPTED';
    if (filter === 'PREPARING') return o.orderStatus === 'PREPARING';
    if (filter === 'READY') return o.orderStatus === 'READY';
    return true;
  });

  const handleQuickNextStatus = async (order: Order) => {
    if (order.orderStatus === 'PENDING' || order.orderStatus === 'ACCEPTED') {
      await orderService.startPreparing(order.id);
    } else if (order.orderStatus === 'PREPARING') {
      await orderService.markReady(order.id);
      if (sound) {
        notificationService.playReadyChime();
      }
    } else if (order.orderStatus === 'READY') {
      await orderService.completeOrder(order.id);
    }
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Rush Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg tracking-tight text-white uppercase">Rush Counter Mode</h1>
              <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                Live Peak
              </span>
            </div>
            <p className="text-xs text-slate-400">Sharma Vada Pav • Tap cards to advance tokens</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={() => setSound(!sound)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
              sound ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Close Rush Mode */}
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Exit Rush</span>
          </button>
        </div>
      </header>

      {/* Rush Quick Filters Bar */}
      <div className="bg-slate-900/60 px-4 py-2 flex items-center gap-2 border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
            filter === 'ALL' ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'
          }`}
        >
          All Tokens ({activeOrders.length})
        </button>

        <button
          onClick={() => setFilter('PENDING')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
            filter === 'PENDING' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-400'
          }`}
        >
          <span>New</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-950/20 text-[10px]">
            {activeOrders.filter((o) => o.orderStatus === 'PENDING' || o.orderStatus === 'ACCEPTED').length}
          </span>
        </button>

        <button
          onClick={() => setFilter('PREPARING')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
            filter === 'PREPARING' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-orange-400'
          }`}
        >
          <span>Cooking</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-950/20 text-[10px]">
            {activeOrders.filter((o) => o.orderStatus === 'PREPARING').length}
          </span>
        </button>

        <button
          onClick={() => setFilter('READY')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
            filter === 'READY' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400'
          }`}
        >
          <span>Ready For Counter</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-950/20 text-[10px]">
            {activeOrders.filter((o) => o.orderStatus === 'READY').length}
          </span>
        </button>
      </div>

      {/* Grid of Big Token Cards */}
      <div className="flex-1 p-4 overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">Rush Queue Cleared!</h3>
            <p className="text-xs text-slate-500">No active tokens in this view.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredOrders.map((order) => {
              const isReady = order.orderStatus === 'READY';
              const isCooking = order.orderStatus === 'PREPARING';
              const isNew = order.orderStatus === 'PENDING' || order.orderStatus === 'ACCEPTED';

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl p-4 flex flex-col justify-between border-2 transition-transform active:scale-98 ${
                    isReady
                      ? 'bg-emerald-950/40 border-emerald-500'
                      : isCooking
                      ? 'bg-orange-950/30 border-orange-500'
                      : 'bg-amber-950/30 border-amber-500'
                  }`}
                >
                  <div>
                    {/* Token Number Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-4xl font-black tracking-tight ${
                          isReady ? 'text-emerald-400' : isCooking ? 'text-orange-400' : 'text-amber-400'
                        }`}>
                          {order.tokenNumber}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-300">
                            {order.orderType === 'DINE_IN' ? (order.tableNumber || 'Dine-in') : 'Takeaway'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
                            {order.customerName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-white">₹{order.total}</span>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {order.paymentStatus === 'PAID' ? 'PAID' : 'CASH'}
                        </div>
                      </div>
                    </div>

                    {/* Quick Items list */}
                    <div className="my-3 py-2 border-y border-slate-800/80 space-y-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200">
                            <span className="text-amber-400 mr-1.5">{item.quantity}×</span>
                            {item.name}
                          </span>
                        </div>
                      ))}

                      {order.instructions && (
                        <p className="text-[11px] text-amber-300 font-bold bg-amber-900/30 px-2 py-1 rounded mt-1">
                          Note: {order.instructions}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Single Tap Progression Button */}
                  <button
                    onClick={() => handleQuickNextStatus(order)}
                    className={`w-full py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-colors ${
                      isNew
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : isCooking
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-white hover:bg-slate-200 text-slate-950'
                    }`}
                  >
                    {isNew && (
                      <>
                        <Flame className="w-5 h-5 fill-current" />
                        <span>Tap to Cook</span>
                      </>
                    )}
                    {isCooking && (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Tap when Ready</span>
                      </>
                    )}
                    {isReady && (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Tap when Collected</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
