import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { orderService } from '../../services/orderService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { notificationService } from '../../services/notificationService';
import { Order } from '../../types';
import { 
  Bell, 
  Clock, 
  ChevronRight, 
  Sparkles, 
  CheckCircle2, 
  Volume2, 
  X, 
  Store 
} from 'lucide-react';

export const ActiveOrderBanner: React.FC = () => {
  const { route, navigate } = useRouter();
  const { currentUser } = useAuth();
  const { highContrast, reducedMotion, announce } = useAccessibility();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [minimized, setMinimized] = useState(false);

  // If user is currently looking at the tracker view for THIS order or is owner, hide the banner
  const isCurrentlyTrackingThisOrder = 
    route.name === 'order-tracker' && 
    route.params.orderId === activeOrder?.id;

  const isOwner = currentUser?.role === 'owner';

  useEffect(() => {
    if (isOwner) return;

    let unsub: (() => void) | undefined;

    const fetchActive = async () => {
      const orders = await orderService.getCustomerOrders(currentUser?.id);
      const active = orders.find(
        (o) =>
          o.orderStatus === 'PENDING' ||
          o.orderStatus === 'ACCEPTED' ||
          o.orderStatus === 'PREPARING' ||
          o.orderStatus === 'READY'
      );

      if (active) {
        setActiveOrder(active);
        unsub = orderRealtimeService.subscribeToOrder(active.id, (updated) => {
          if (
            updated.orderStatus === 'PENDING' ||
            updated.orderStatus === 'ACCEPTED' ||
            updated.orderStatus === 'PREPARING' ||
            updated.orderStatus === 'READY'
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
  }, [currentUser?.id, isOwner, announce]);

  if (!activeOrder || isCurrentlyTrackingThisOrder || isOwner) {
    return null;
  }

  const isReady = activeOrder.orderStatus === 'READY';

  const statusLabel = 
    activeOrder.orderStatus === 'READY'
      ? 'READY FOR PICKUP'
      : activeOrder.orderStatus === 'PREPARING'
      ? 'PREPARING IN KITCHEN'
      : activeOrder.orderStatus === 'ACCEPTED'
      ? 'ORDER ACCEPTED'
      : 'ORDER PLACED';

  const playChime = (e: React.MouseEvent) => {
    e.stopPropagation();
    notificationService.playReadyChime();
    announce(`Token ${activeOrder.tokenNumber} at ${activeOrder.shopName}`, 'polite', true);
  };

  if (minimized) {
    return (
      <div className="fixed bottom-20 sm:bottom-6 right-4 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
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
      className="sticky top-16 z-25 w-full bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white shadow-md border-b border-orange-500/40"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Token & Info */}
        <div 
          onClick={() => navigate(`/order/${activeOrder.id}`)}
          className="flex items-center gap-3 cursor-pointer group min-w-0 flex-1"
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
          <div className="flex-shrink-0 px-2.5 py-1 rounded-xl bg-white text-orange-900 font-mono font-black text-sm sm:text-base tracking-tight shadow-sm border border-orange-200">
            {activeOrder.tokenNumber}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/20 text-orange-100 flex items-center gap-1">
                {isReady ? (
                  <Sparkles className="w-3 h-3 text-amber-300" />
                ) : (
                  <Clock className="w-3 h-3 text-orange-200" />
                )}
                <span>{statusLabel}</span>
              </span>
              <span className="text-xs font-bold text-white truncate group-hover:underline">
                {activeOrder.shopName}
              </span>
            </div>
            <p className="text-[11px] text-orange-100/90 truncate hidden sm:block">
              {isReady
                ? 'Your order is ready! Please collect at the counter.'
                : `Estimated prep: ~${activeOrder.estimatedPreparationMinutes} min. Tap to track live status.`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={playChime}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Play token announcement sound"
            aria-label="Sound chime"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate(`/order/${activeOrder.id}`)}
            className="px-3 py-1.5 rounded-xl bg-white text-orange-900 hover:bg-orange-50 font-bold text-xs transition-colors flex items-center gap-1 shadow-sm"
          >
            <span>Track Live</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-xl hover:bg-white/20 text-orange-200 hover:text-white transition-colors"
            title="Minimize tracking banner"
            aria-label="Minimize order tracker bar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
