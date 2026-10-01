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
  Store,
  Star
} from 'lucide-react';
import { PostOrderFeedbackModal } from '../order/PostOrderFeedbackModal';

export const ActiveOrderBanner: React.FC = () => {
  const { route, navigate } = useRouter();
  const { currentUser } = useAuth();
  const { highContrast, reducedMotion, announce } = useAccessibility();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [unreviewedCompletedOrder, setUnreviewedCompletedOrder] = useState<Order | null>(null);
  const [dismissedFeedbackIds, setDismissedFeedbackIds] = useState<string[]>([]);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // If user is currently looking at the tracker view for THIS order or is owner, hide the banner
  const isCurrentlyTrackingThisOrder = 
    route.name === 'order-tracker' && 
    (route.params.orderId === activeOrder?.id || route.params.orderId === unreviewedCompletedOrder?.id);

  const isOwner = currentUser?.role === 'owner';

  useEffect(() => {
    if (!currentUser || isOwner) {
      setActiveOrder(null);
      setUnreviewedCompletedOrder(null);
      return;
    }

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
        setUnreviewedCompletedOrder(null);
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
            if (updated.orderStatus === 'COMPLETED' && !updated.rating) {
              setUnreviewedCompletedOrder(updated);
            }
          }
        });
      } else {
        setActiveOrder(null);
        // Find most recently completed order that hasn't been rated and hasn't been dismissed
        const completedUnrated = orders.find(
          (o) => o.orderStatus === 'COMPLETED' && !o.rating && !dismissedFeedbackIds.includes(o.id)
        );
        setUnreviewedCompletedOrder(completedUnrated || null);
      }
    };

    fetchActive();
    const interval = setInterval(fetchActive, 6000);

    return () => {
      if (unsub) unsub();
      clearInterval(interval);
    };
  }, [currentUser?.id, isOwner, announce, dismissedFeedbackIds]);

  if (isCurrentlyTrackingThisOrder || isOwner) {
    return null;
  }

  // 1. Post-order feedback prompt banner if completed and not yet reviewed
  if (!activeOrder && unreviewedCompletedOrder) {
    return (
      <>
        <aside
          aria-label="Post-order feedback rating prompt"
          className="sticky top-16 z-25 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md border-b border-amber-500/40 animate-in fade-in duration-300"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <div 
              onClick={() => setIsFeedbackModalOpen(true)}
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0 flex-1"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsFeedbackModalOpen(true);
                }
              }}
            >
              <div className="flex-shrink-0 px-2 py-1 rounded-xl bg-white text-amber-900 font-mono font-black text-xs sm:text-sm tracking-tight shadow-sm border border-amber-200">
                {unreviewedCompletedOrder.tokenNumber}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/25 text-amber-100 flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                    <span>Done</span>
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
                    {unreviewedCompletedOrder.shopName}
                  </span>
                </div>
                <p className="text-[11px] text-amber-100/90 truncate hidden sm:block">
                  Food collected! How was your stall experience? Tap to share your rating & review.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setIsFeedbackModalOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs transition-transform active:scale-95 flex items-center gap-1 shadow-sm"
              >
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>Rate<span className="hidden xs:inline"> Stall</span></span>
              </button>

              <button
                onClick={() => {
                  if (unreviewedCompletedOrder) {
                    setDismissedFeedbackIds((prev) => [...prev, unreviewedCompletedOrder.id]);
                  }
                  setUnreviewedCompletedOrder(null);
                }}
                className="p-1.5 rounded-xl hover:bg-white/20 text-amber-200 hover:text-white transition-colors"
                title="Dismiss rating reminder"
                aria-label="Dismiss rating prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        <PostOrderFeedbackModal
          order={unreviewedCompletedOrder}
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          onFeedbackSubmitted={(updated) => {
            setUnreviewedCompletedOrder(null);
            announce('Thank you! Your rating has been recorded for the food stall.', 'polite');
          }}
        />
      </>
    );
  }

  if (!activeOrder) {
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
      className="sticky top-15 sm:top-16 z-25 w-full bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white shadow-md border-b border-orange-500/40"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-3">
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
          <div className="flex-shrink-0 px-2 sm:px-2.5 py-1 rounded-xl bg-white text-orange-900 font-mono font-black text-xs sm:text-base tracking-tight shadow-sm border border-orange-200">
            {activeOrder.tokenNumber}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-black/20 text-orange-100 flex items-center gap-1 flex-shrink-0">
                {isReady ? (
                  <Sparkles className="w-3 h-3 text-amber-300" />
                ) : (
                  <Clock className="w-3 h-3 text-orange-200" />
                )}
                <span>{statusLabel}</span>
              </span>
              <span className="text-xs font-bold text-white truncate max-w-[110px] xs:max-w-[160px] sm:max-w-none group-hover:underline">
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
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={playChime}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Play token announcement sound"
            aria-label="Sound chime"
          >
            <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => navigate(`/order/${activeOrder.id}`)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white text-orange-900 hover:bg-orange-50 font-bold text-xs transition-colors flex items-center gap-1 shadow-sm"
          >
            <span>Track<span className="hidden xs:inline"> Live</span></span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setMinimized(true)}
            className="p-1 sm:p-1.5 rounded-xl hover:bg-white/20 text-orange-200 hover:text-white transition-colors"
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
