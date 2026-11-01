import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { orderService } from '../../services/orderService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { notificationService } from '../../services/notificationService';
import { Order } from '../../types';
import { 
  Clock, 
  ChevronRight, 
  Sparkles, 
  Volume2
} from 'lucide-react';

export const ActiveOrderBanner: React.FC = () => {
  const { route, navigate } = useRouter();
  const { currentUser } = useAuth();
  const { highContrast, announce } = useAccessibility();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [minimized, setMinimized] = useState(false);

  // If user is currently looking at the tracker view for THIS order, hide the banner
  const isCurrentlyTrackingThisOrder = 
    route.name === 'order-tracker' && 
    route.params.orderId === activeOrder?.id;

  useEffect(() => {
    if (!currentUser) {
      setActiveOrder(null);
      return;
    }

    let unsub: (() => void) | undefined;

    const fetchActive = async () => {
      const orders = await orderService.getCustomerOrders(currentUser?.id);
      const active = orders.find(
        (o) =>
          // Only show banner for confirmed orders (paid online OR cash at counter)
          (o.paymentStatus === 'PAID' || o.paymentMethod === 'CASH_AT_COUNTER') &&
          (o.orderStatus === 'PENDING' ||
           o.orderStatus === 'ACCEPTED' ||
           o.orderStatus === 'PREPARING' ||
           o.orderStatus === 'READY')
      );

      if (active) {
        setActiveOrder(active);
        unsub = orderRealtimeService.subscribeToOrder(active.id, (updated) => {
          if (
            (updated.paymentStatus === 'PAID' || updated.paymentMethod === 'CASH_AT_COUNTER') &&
            (updated.orderStatus === 'PENDING' ||
             updated.orderStatus === 'ACCEPTED' ||
             updated.orderStatus === 'PREPARING' ||
             updated.orderStatus === 'READY')
          ) {
            setActiveOrder(updated);
            if (updated.orderStatus === 'READY') {
              announce(
                `Attention: Your token ${updated.tokenNumber} is ready for pickup at ${updated.shopName}!`,
                'assertive',
                true
              );
            }
          } else {
            setActiveOrder(null);
          }
        });
      } else {
        setActiveOrder(null);
      }
    };

    fetchActive();
    const interval = setInterval(fetchActive, 6000);

    return () => {
      if (unsub) unsub();
      clearInterval(interval);
    };
  }, [currentUser?.id, announce]);

  if (isCurrentlyTrackingThisOrder || !activeOrder) {
    return null;
  }

  const isReady = activeOrder.orderStatus === 'READY';

  const statusLabel = 
    activeOrder.orderStatus === 'READY'
      ? 'READY'
      : activeOrder.orderStatus === 'PREPARING'
      ? 'PREPARING'
      : activeOrder.orderStatus === 'ACCEPTED'
      ? 'ACCEPTED'
      : 'PLACED';

  const playChime = (e: React.MouseEvent) => {
    e.stopPropagation();
    notificationService.playReadyChime();
    announce(`Token ${activeOrder.tokenNumber} at ${activeOrder.shopName}`, 'polite', true);
  };

  if (minimized) {
    return (
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 right-4 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <button
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-xl text-xs font-bold transition-transform active:scale-95 ${
            isReady
              ? 'bg-emerald-600 text-white animate-bounce'
              : 'bg-slate-900 text-white'
          } ${highContrast ? 'border-2 border-black' : ''}`}
          aria-label="Expand active order status"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Active Token {activeOrder.tokenNumber}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Active live order status"
      className="sticky top-15 sm:top-16 z-25 w-full bg-slate-900/95 backdrop-blur-md text-white shadow-card border-b border-slate-800"
    >
      <div className="max-w-5xl mx-auto px-3.5 sm:px-6 py-2 flex items-center justify-between gap-2.5 sm:gap-3">
        {/* Token & Info */}
        <div 
          onClick={() => navigate(`/order/${activeOrder.id}`)}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0 flex-1"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate(`/order/${activeOrder.id}`);
            }
          }}
          aria-label={`View live tracker for token ${activeOrder.tokenNumber} at ${activeOrder.shopName}`}
        >
          {/* Token badge */}
          <div className="flex-shrink-0 px-2.5 py-1 rounded-xl bg-orange-500/20 text-orange-400 font-mono font-bold text-xs sm:text-sm tracking-tight border border-orange-500/30">
            #{activeOrder.tokenNumber}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 border ${
                isReady
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
              }`}>
                {isReady ? (
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                ) : (
                  <Clock className="w-3 h-3 text-orange-300" />
                )}
                <span>{statusLabel}</span>
              </span>
              <span className="text-xs font-semibold text-white truncate max-w-[110px] xs:max-w-[160px] sm:max-w-none group-hover:text-orange-300 transition-colors">
                {activeOrder.shopName}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate hidden sm:block">
              {isReady
                ? 'Your order is ready! Please collect at the counter.'
                : `Estimated prep: ~${activeOrder.estimatedPreparationMinutes} min. Tap to track live status.`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={playChime}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Play token announcement sound"
            aria-label="Sound chime"
          >
            <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Minimize banner"
            aria-label="Minimize order banner"
          >
            <ChevronRight className="w-4 h-4 rotate-90" />
          </button>
        </div>
      </div>
    </aside>
  );
};
