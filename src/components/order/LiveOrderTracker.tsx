import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Order, OrderStatus, Shop } from '../../types';
import { orderService } from '../../services/orderService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { notificationService } from '../../services/notificationService';
import { shopService } from '../../services/shopService';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useRouter } from '../../context/RouterContext';
import { 
  CheckCircle2, 
  Clock, 
  Bell, 
  Store, 
  MapPin, 
  Receipt, 
  Share2, 
  Sparkles,
  Volume2,
  VolumeX,
  ChevronRight,
  UtensilsCrossed,
  ShoppingBag,
  Navigation,
  Phone,
  QrCode,
  ShieldCheck,
  Send,
  MessageSquare,
  Printer,
  Copy,
  Check,
  Users,
  AlertCircle,
  XCircle,
  Ban,
  Star
} from 'lucide-react';
import { VegBadge } from '../common/VegBadge';
import { GoogleShopMap } from '../common/GoogleShopMap';
import { CancelOrderModal } from './CancelOrderModal';
import { OrderRatingReview } from './OrderRatingReview';

interface LiveOrderTrackerProps {
  orderId: string;
}

interface StageStep {
  status: OrderStatus;
  label: string;
  desc: string;
  detail: string;
}

const ORDER_STAGES: StageStep[] = [
  { 
    status: 'PENDING', 
    label: 'Order Placed', 
    desc: 'Sent to counter terminal',
    detail: 'Stall terminal received your order token.'
  },
  { 
    status: 'ACCEPTED', 
    label: 'Confirmed in Queue', 
    desc: 'Slot verified by chef',
    detail: 'Ingredients staged and queue slot locked in.'
  },
  { 
    status: 'PREPARING', 
    label: 'Cooking on Tawa', 
    desc: 'Hot & fresh on the griddle',
    detail: 'Cooking your items fresh to order.'
  },
  { 
    status: 'READY', 
    label: 'Ready for Pickup', 
    desc: 'Token called at counter',
    detail: 'Food packed and waiting at the counter pickup window.'
  },
  { 
    status: 'COMPLETED', 
    label: 'Order Collected', 
    desc: 'Enjoy your meal!',
    detail: 'Token verified and order successfully handed over.'
  },
];

const STATUS_LEVELS: Record<OrderStatus, number> = {
  PENDING: 1,
  ACCEPTED: 2,
  PREPARING: 3,
  READY: 4,
  COMPLETED: 5,
  CANCELLED: 0,
};

export const LiveOrderTracker: React.FC<LiveOrderTrackerProps> = ({ orderId }) => {
  const { navigate } = useRouter();
  const { highContrast, reducedMotion, announce } = useAccessibility();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPickupPassModal, setShowPickupPassModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'map' | 'receipt' | 'messages'>('timeline');
  const [shop, setShop] = useState<Shop | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isReadyTransitioning, setIsReadyTransitioning] = useState<boolean>(false);
  const prevStatusRef = useRef<OrderStatus | null>(null);

  // Customer quick signals sent to stall
  const [customerSignals, setCustomerSignals] = useState<Array<{ text: string; time: string; from: 'customer' | 'stall' }>>([
    { text: 'Order queued at stall counter. We will notify you once cooking starts.', time: 'Just now', from: 'stall' }
  ]);
  const [customMsgInput, setCustomMsgInput] = useState('');

  // Queue position calculation
  const [queueAheadCount, setQueueAheadCount] = useState<number>(2);
  const [currentServingToken, setCurrentServingToken] = useState<string>('#138');

  // Countdown timer for preparation
  const [secondsRemaining, setSecondsRemaining] = useState<number>(360);

  // Sound announcement states
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Generate a deterministic 4-digit pickup PIN from order id
  const pickupPin = useMemo(() => {
    if (!order) return '4821';
    let hash = 0;
    for (let i = 0; i < order.id.length; i++) {
      hash = (hash * 31 + order.id.charCodeAt(i)) % 10000;
    }
    return String(Math.abs(hash)).padStart(4, '7');
  }, [order?.id]);

  const handleCustomerCancel = async (reason: string) => {
    if (!order) return;
    const updated = await orderService.cancelOrder(order.id, reason, 'customer');
    if (updated) {
      setOrder(updated);
      announce(`Order ${updated.tokenNumber} has been cancelled.`, 'assertive', true);
    }
  };

  const triggerReadyAnimation = () => {
    setIsReadyTransitioning(true);
    notificationService.playReadyChime();
    announce(`Ding! Token ${order?.tokenNumber || ''} is ready for pickup!`, 'assertive', true);
    setTimeout(() => {
      setIsReadyTransitioning(false);
    }, 4500);
  };

  // Subtle status-update animation when transitioning specifically from PREPARING to READY
  useEffect(() => {
    if (!order) return;
    const prev = prevStatusRef.current;
    if (prev === 'PREPARING' && order.orderStatus === 'READY') {
      setIsReadyTransitioning(true);
      const timer = setTimeout(() => setIsReadyTransitioning(false), 4500);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = order.orderStatus;
  }, [order?.orderStatus]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadOrder = async () => {
      setLoading(true);
      const data = await orderService.getOrder(orderId);
      setOrder(data);
      setLoading(false);

      if (data) {
        // Fetch full shop data for map coordinates and details
        shopService.getShop(data.shopId).then((s) => {
          if (s) setShop(s);
        });
        // Initial queue calculation
        const tokenNum = parseInt(data.tokenNumber.replace('#', ''), 10) || 140;
        setQueueAheadCount(Math.max(1, tokenNum - 138));
        setCurrentServingToken(`#${Math.max(1, tokenNum - 2)}`);

        // Calculate countdown based on prep minutes
        const prepMins = parseInt(data.estimatedPreparationMinutes, 10) || 7;
        const createdMs = new Date(data.createdAt).getTime();
        const elapsedSecs = Math.max(0, Math.floor((Date.now() - createdMs) / 1000));
        const totalSecs = prepMins * 60;
        setSecondsRemaining(Math.max(30, totalSecs - elapsedSecs));

        unsubscribe = orderRealtimeService.subscribeToOrder(orderId, (updatedOrder) => {
          setOrder(updatedOrder);

          if (updatedOrder.orderStatus === 'READY') {
            announce(
              `Ding! Token ${updatedOrder.tokenNumber}, your order at ${updatedOrder.shopName} is ready for pickup!`,
              'assertive',
              true
            );
            notificationService.playReadyChime();
          } else if (updatedOrder.orderStatus === 'PREPARING') {
            announce(`Token ${updatedOrder.tokenNumber} is now being prepared in the kitchen.`, 'polite');
          } else if (updatedOrder.orderStatus === 'COMPLETED') {
            announce(`Token ${updatedOrder.tokenNumber} has been collected. Thank you!`, 'polite');
          }
        });
      }
    };

    loadOrder();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [orderId, announce]);

  // Live countdown timer tick
  useEffect(() => {
    if (!order || order.orderStatus === 'READY' || order.orderStatus === 'COMPLETED' || order.orderStatus === 'CANCELLED') {
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order]);

  const advanceOrderStatus = async (nextStatus: OrderStatus) => {
    if (!order) return;
    const updated = await orderService.updateOrderStatus(order.id, nextStatus);
    if (updated) {
      setOrder(updated);
      if (nextStatus === 'READY') {
        notificationService.sendReadyNotification(updated.tokenNumber, updated.shopName);
        announce(`Token ${updated.tokenNumber} is ready for collection at the counter!`, 'assertive', true);
        setQueueAheadCount(0);
        setCurrentServingToken(updated.tokenNumber);
      } else if (nextStatus === 'PREPARING') {
        announce(`Stall started preparing your order.`, 'polite');
        setQueueAheadCount(1);
      } else if (nextStatus === 'COMPLETED') {
        announce(`Order completed and collected.`, 'polite');
      }
    }
  };

  const playVoiceAnnouncement = () => {
    if (!order) return;
    setIsSpeaking(true);
    const text = `Attention customer: Token number ${order.tokenNumber.replace('#', '')}. Your order at ${order.shopName} is ${
      order.orderStatus === 'READY' ? 'ready for pickup at Counter 1' : 'currently in progress'
    }. Please show token ${order.tokenNumber.replace('#', '')} when collecting.`;
    
    notificationService.playReadyChime();
    announce(text, 'assertive', true);

    setTimeout(() => setIsSpeaking(false), 3000);
  };

  const handleSendSignal = (presetText: string) => {
    const newMsg = { text: presetText, time: 'Just now', from: 'customer' as const };
    setCustomerSignals((prev) => [...prev, newMsg]);
    announce(`Message sent to stall: "${presetText}"`, 'polite');

    // Simulate stall chef automated acknowledgment
    setTimeout(() => {
      let replyText = 'Got it! Noted at the counter.';
      if (presetText.includes('chutney')) {
        replyText = 'Extra spicy garlic & mint chutney added to your parcel! 👍';
      } else if (presetText.includes('arrived')) {
        replyText = 'Welcome! Your token is queued on the counter display.';
      } else if (presetText.includes('late')) {
        replyText = 'No problem, we will keep your food warm in the container.';
      }
      setCustomerSignals((prev) => [...prev, { text: replyText, time: 'Just now', from: 'stall' }]);
      announce(`Stall response: "${replyText}"`, 'polite');
    }, 1500);
  };

  const handleShareToken = () => {
    if (!order) return;
    const shareText = `FoodFlow Order Token: ${order.tokenNumber} at ${order.shopName} | Status: ${order.orderStatus}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `FoodFlow Token ${order.tokenNumber}`,
        text: shareText,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      announce('Order token copied to clipboard', 'polite');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <div 
        role="status" 
        aria-live="polite" 
        aria-label="Loading order details"
        className="max-w-lg mx-auto p-6 space-y-4"
      >
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="h-40 bg-slate-200 rounded-2xl animate-pulse" />
        <span className="sr-only">Loading live order tracking...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm mt-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Order token not found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          This order token may have expired or belongs to another session.
        </p>
        <button
          onClick={() => navigate('/orders')}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-orange-600"
        >
          View All Orders
        </button>
      </div>
    );
  }

  const currentLevel = STATUS_LEVELS[order.orderStatus] || 1;
  const isCancelled = order.orderStatus === 'CANCELLED';
  const isReady = order.orderStatus === 'READY';
  const isCompleted = order.orderStatus === 'COMPLETED';

  // Format countdown minutes and seconds
  const formattedCountdown = `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`;

  // Progress percentage calculation
  const totalPrepSecs = (parseInt(order.estimatedPreparationMinutes, 10) || 7) * 60;
  const progressPercent = isCompleted 
    ? 100 
    : isCancelled
    ? 0
    : isReady 
    ? 90 
    : Math.min(85, Math.max(15, Math.round(((totalPrepSecs - secondsRemaining) / totalPrepSecs) * 100)));

  return (
    <article 
      aria-label={`Live Order Tracker for Token ${order.tokenNumber}`}
      className="max-w-xl mx-auto pb-28 px-4 sm:px-6 pt-2 space-y-4"
    >
      {/* 1. CANCELLED CALLOUT BANNER */}
      {isCancelled && (
        <section
          role="alert"
          aria-live="assertive"
          className="p-5 rounded-3xl bg-red-600 text-white shadow-xl shadow-red-600/25 border-2 border-red-300 space-y-3"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-200 block">
                Order Status
              </span>
              <h3 className="text-xl font-black tracking-tight leading-tight mt-0.5">
                Token {order.tokenNumber} is Cancelled
              </h3>
              <p className="text-xs text-red-100 font-medium mt-1">
                {order.cancellationReason
                  ? `Reason: "${order.cancellationReason}"`
                  : 'This order token has been cancelled and the stall owner has been notified.'}
              </p>
              {order.cancelledAt && (
                <p className="text-[10px] text-red-200 mt-1">
                  Cancelled at {new Date(order.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="pt-1 flex gap-2">
            <button
              onClick={() => navigate(`/shop/${order.shopId}`)}
              className="flex-1 py-2 px-3 rounded-xl bg-white text-red-950 font-bold text-xs hover:bg-red-50 transition-colors shadow-xs"
            >
              Reorder from Stall
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="py-2 px-4 rounded-xl bg-red-800 text-white font-bold text-xs hover:bg-red-900 transition-colors"
            >
              View Order History
            </button>
          </div>
        </section>
      )}

      {/* 1.1 HIGH-PRIORITY READY CALLOUT BANNER */}
      {!isCancelled && isReady && (
        <section
          role="alert"
          aria-live="assertive"
          className={`p-5 rounded-3xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/25 border-2 border-emerald-300 flex items-start justify-between gap-3 ${
            reducedMotion ? '' : 'animate-in zoom-in-95 duration-200'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
              <Bell className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-200 block">
                Ding! Counter Announcement
              </span>
              <h3 className="text-xl font-black tracking-tight leading-tight mt-0.5">
                Token {order.tokenNumber} is Ready!
              </h3>
              <p className="text-xs text-emerald-100 font-medium mt-1">
                Please collect your hot food at <span className="font-bold text-white underline">{order.shopName}</span> counter.
              </p>
              <div className="mt-2.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-800/60 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Show Token or PIN: <strong className="font-mono text-white text-xs">{pickupPin}</strong></span>
              </div>
            </div>
          </div>
          <button
            onClick={playVoiceAnnouncement}
            className="p-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white flex-shrink-0 flex items-center justify-center shadow-xs transition-colors"
            title="Speak counter call"
            aria-label="Replay audio counter announcement"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </section>
      )}

      {/* 2. HERO COUNTER TOKEN CARD & DIGITAL PASS */}
      <section 
        aria-label="Counter Token Pass"
        className={`relative overflow-hidden bg-white rounded-3xl border-2 transition-all duration-500 ${
          isCancelled
            ? 'border-red-400 shadow-red-500/10'
            : isReady
            ? isReadyTransitioning && !reducedMotion
              ? 'border-emerald-500 ring-4 ring-emerald-400/40 shadow-2xl shadow-emerald-500/25 animate-status-ready-pop'
              : 'border-emerald-500 shadow-emerald-500/10'
            : 'border-orange-500 shadow-orange-500/10'
        } p-6 shadow-xl text-center`}
      >
        {/* Subtle light sweep shimmer during status update transition */}
        {isReadyTransitioning && !reducedMotion && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-0">
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent animate-status-shimmer" />
          </div>
        )}

        <div className={`relative z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-2 ${
          isCancelled
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-orange-50 text-orange-800 border-orange-200'
        }`}>
          {isCancelled ? (
            <>
              <Ban className="w-3.5 h-3.5 text-red-600" />
              <span>Token Cancelled</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Show this Digital Pass at Stall Counter</span>
            </>
          )}
        </div>

        {/* Transitioning Alert Pill */}
        {isReadyTransitioning && (
          <div className="relative z-10 mb-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black shadow-md shadow-emerald-600/30 animate-ready-badge">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Ding! Counter Status: Ready for Pickup! 🔔</span>
          </div>
        )}

        {/* Big Bold Token Number */}
        <div className="relative z-10 my-1">
          <span className="text-xs uppercase tracking-widest text-slate-500 font-extrabold block">
            Counter Token Number
          </span>
          <div 
            tabIndex={0}
            aria-label={`Token number ${order.tokenNumber}`}
            className="text-6xl sm:text-7xl font-black tracking-tight text-slate-900 font-mono my-0.5 select-all"
          >
            {order.tokenNumber}
          </div>
        </div>

        {/* 4-Digit Security PIN & Barcode Simulator */}
        <div className="relative z-10 inline-flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 my-2">
          <span className="text-slate-500 font-medium">Pickup PIN:</span>
          <span className="font-mono font-black text-slate-900 text-sm tracking-wider">{pickupPin}</span>
          <span className="text-slate-300">|</span>
          <button 
            onClick={() => setShowPickupPassModal(true)}
            className="text-orange-700 hover:text-orange-800 hover:underline flex items-center gap-1"
            aria-label="View QR code barcode for counter scanner"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR Barcode</span>
          </button>
        </div>

        {/* Stall & Order Info */}
        <div className="relative z-10 pt-3 border-t border-slate-100 flex items-center justify-center flex-wrap gap-2 text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-orange-600" />
            {order.shopName}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-slate-600 px-2 py-0.5 rounded-md bg-slate-100">
            {order.orderType === 'DINE_IN'
              ? `Dine-in (${order.tableNumber || 'Table assigned'})`
              : 'Takeaway Parcel'}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-slate-600 px-2 py-0.5 rounded-md bg-slate-100">
            {order.paymentMethod === 'CASH_AT_COUNTER' ? 'Cash at Counter' : 'Online Paid ✓'}
          </span>
        </div>

        {/* Quick Toolbar */}
        <div className="relative z-10 mt-4 flex items-center justify-center flex-wrap gap-2">
          <button
            onClick={playVoiceAnnouncement}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-600"
            aria-label="Speak order token announcement using text to speech"
          >
            <Volume2 className="w-3.5 h-3.5 text-orange-600" />
            <span>{isSpeaking ? 'Speaking...' : 'Voice Announce'}</span>
          </button>

          {/* Status animation trigger button for testing & replay */}
          <button
            onClick={triggerReadyAnimation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors border border-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-600"
            title="Preview the subtle status update transition animation"
            aria-label="Preview ready status animation"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isReadyTransitioning ? 'Updating Status...' : 'Preview Ready Alert'}</span>
          </button>

          <button
            onClick={handleShareToken}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-600"
            aria-label="Share token with friend or save to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-600" />}
            <span>{copied ? 'Copied!' : 'Share Token'}</span>
          </button>

          <button
            onClick={printReceipt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-600"
            aria-label="Print or save digital counter receipt"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Pass</span>
          </button>

          {/* Cancellation Trigger */}
          {!isCancelled && !isCompleted && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors border border-red-200 focus-visible:ring-2 focus-visible:ring-red-600"
              aria-label="Cancel this order"
            >
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Cancel Order</span>
            </button>
          )}
        </div>
      </section>

      {/* 2.1 COMPLETED ORDER STAR RATING & REVIEW CARD */}
      {isCompleted && (
        <section aria-label="Customer Review and Rating Feedback">
          <OrderRatingReview
            order={order}
            onReviewSubmitted={(updated) => setOrder(updated)}
          />
        </section>
      )}

      {/* 3. REAL-TIME QUEUE & COUNTDOWN HIGHLIGHT */}
      <section 
        aria-label="Real-time Queue Status"
        className="grid grid-cols-2 gap-3"
      >
        {/* Estimated Prep Timer */}
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between transition-all duration-500 ${
          isReadyTransitioning && !reducedMotion
            ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/40 animate-status-ready-pop'
            : isReady
            ? 'bg-emerald-50/40 border-emerald-200'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-600" />
              <span>Est. Preparation</span>
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
            }`}>
              {isReady ? 'Ready' : 'Live'}
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {isCompleted ? 'Finished' : isReady ? 'Ready Now' : formattedCountdown}
            </div>
            <span className="text-[11px] text-slate-500">
              {isReady ? 'Hot & packaged at counter' : `Approx ~${order.estimatedPreparationMinutes} mins total`}
            </span>
          </div>
          {/* Progress bar */}
          <div 
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Order preparation progress"
            className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"
          >
            <div 
              className={`h-full transition-all duration-500 ${
                isReady ? 'bg-emerald-500' : 'bg-orange-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Queue Position */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Queue Status</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Active
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {isCompleted ? 'Served' : isReady ? 'Your Turn!' : `${queueAheadCount} Ahead`}
            </div>
            <span className="text-[11px] text-slate-500">
              {isReady ? 'Proceed to counter window' : `Currently Calling ${currentServingToken}`}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Counter 1 Serving Smoothly</span>
          </div>
        </div>
      </section>

      {/* 4. TRACKER NAVIGATION TABS */}
      <nav 
        aria-label="Tracker section tabs"
        className="flex items-center p-1 bg-slate-200/70 rounded-2xl text-xs font-bold text-slate-700"
      >
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all ${
            activeTab === 'timeline'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-selected={activeTab === 'timeline'}
          role="tab"
        >
          Live Pipeline
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all ${
            activeTab === 'map'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-selected={activeTab === 'map'}
          role="tab"
        >
          Stall & Directions
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all ${
            activeTab === 'messages'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-selected={activeTab === 'messages'}
          role="tab"
        >
          Stall Signals ({customerSignals.length})
        </button>
        <button
          onClick={() => setActiveTab('receipt')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all ${
            activeTab === 'receipt'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-selected={activeTab === 'receipt'}
          role="tab"
        >
          Receipt
        </button>
      </nav>

      {/* TAB 1: LIVE ORDER TIMELINE */}
      {activeTab === 'timeline' && (
        <section 
          aria-label="Order Stages Timeline"
          className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>Real-time Preparation Pipeline</span>
            </h4>
            <span className="text-xs text-slate-500 font-medium">
              Order #{order.id.slice(-5)}
            </span>
          </div>

          {/* Semantic Ordered List */}
          <ol 
            aria-label="Order progress stages"
            className="space-y-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200"
          >
            {ORDER_STAGES.map((stage, idx) => {
              const stageLevel = STATUS_LEVELS[stage.status];
              const isDone = currentLevel > stageLevel;
              const isCurrent = currentLevel === stageLevel;

              return (
                <li 
                  key={stage.status}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="relative flex items-start gap-3.5"
                >
                  {/* Stage Node Icon */}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      isDone
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-orange-600 text-white ring-4 ring-orange-100 animate-pulse'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    } ${
                      stage.status === 'READY' && isReadyTransitioning && !reducedMotion
                        ? 'ring-4 ring-emerald-300 animate-status-ready-pop scale-110'
                        : ''
                    }`}
                  >
                    {stage.status === 'READY' && isReadyTransitioning && !reducedMotion && (
                      <span className="absolute -inset-1 rounded-full bg-emerald-400/50 animate-ping pointer-events-none" />
                    )}
                    {isDone ? (
                      <CheckCircle2 className="w-4.5 h-4.5 stroke-[3]" />
                    ) : (
                      <span className="text-xs font-black">{idx + 1}</span>
                    )}
                  </div>

                  {/* Stage Info */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <h5
                        className={`text-xs font-bold leading-none ${
                          stage.status === 'READY' && isReadyTransitioning
                            ? 'text-emerald-600 font-black'
                            : isCurrent
                            ? 'text-orange-600 font-black'
                            : isDone
                            ? 'text-slate-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {stage.label}
                      </h5>
                      {stage.status === 'READY' && isReadyTransitioning ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-300">
                          Just Ready! 🔔
                        </span>
                      ) : isCurrent ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                          In Progress
                        </span>
                      ) : isDone ? (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                          Done ✓
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      {stage.desc}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {stage.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Contextual instruction */}
          <div className="p-3 rounded-2xl bg-orange-50/80 border border-orange-200/70 text-center">
            <p className="text-xs font-bold text-orange-950">
              💡 Please remain nearby. When token {order.tokenNumber} sounds, present your screen at the stall counter.
            </p>
          </div>
        </section>
      )}

      {/* TAB 2: STALL DIRECTIONS & MAP */}
      {activeTab === 'map' && (
        <section 
          aria-label="Stall Location and Directions"
          className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <span>Counter Location & Live Map</span>
            </h4>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              ~2 min walk
            </span>
          </div>

          {/* Real-time Google Maps & GPS Coordinate Visualizer */}
          <GoogleShopMap
            shopName={order.shopName}
            shopLocation={order.shopLocation}
            landmark={shop?.location?.landmark}
            address={shop?.location?.address || shop?.address || order.shopLocation}
            latitude={shop?.latitude || shop?.location?.latitude || 19.1197}
            longitude={shop?.longitude || shop?.location?.longitude || 72.8464}
            height="h-56"
          />

          {/* Counter Pickup Details */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pickup Counter:</span>
              <span className="font-bold text-slate-900">Window 1 (Online Orders Fast-Track)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Stall Contact:</span>
              <span className="font-bold text-slate-900">{shop?.phone || '+91 98921 77880'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Dine-in / Seating:</span>
              <span className="font-bold text-slate-900">
                {shop?.tableServiceAvailable ? 'Available behind counter' : 'Counter pickup only'}
              </span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <a
              href={`tel:${shop?.phone || '+919892177880'}`}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
            >
              <Phone className="w-4 h-4 text-slate-600" />
              <span>Call Stall ({shop?.phone || '+91 98921 77880'})</span>
            </a>
          </div>
        </section>
      )}

      {/* TAB 3: STALL SIGNALS & MESSAGES */}
      {activeTab === 'messages' && (
        <section 
          aria-label="Stall communication feed"
          className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <span>Stall Quick Signals</span>
            </h4>
            <span className="text-xs text-slate-500">
              Live updates with kitchen
            </span>
          </div>

          {/* Quick preset buttons */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Tap to send instant update to counter:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSendSignal('👋 I have arrived at the counter')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
              >
                👋 I am at the counter
              </button>
              <button
                onClick={() => handleSendSignal('🥫 Extra green chutney & tissues please')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
              >
                🥫 Extra green chutney
              </button>
              <button
                onClick={() => handleSendSignal('⏳ Running 5 mins late, please keep food warm')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
              >
                ⏳ Running 5 mins late
              </button>
              <button
                onClick={() => handleSendSignal('🥡 Please pack securely for travel')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-orange-900 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
              >
                🥡 Pack for takeaway
              </button>
            </div>
          </div>

          {/* Message stream */}
          <div 
            aria-live="polite"
            className="space-y-2.5 max-h-56 overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200"
          >
            {customerSignals.map((msg, i) => (
              <div 
                key={i} 
                className={`flex flex-col ${msg.from === 'customer' ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs font-semibold ${
                    msg.from === 'customer'
                      ? 'bg-orange-600 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-2xs'
                  }`}
                >
                  <span className="text-[10px] block opacity-80 mb-0.5 font-bold">
                    {msg.from === 'customer' ? 'You' : `${order.shopName} (Counter)`}
                  </span>
                  {msg.text}
                </div>
                <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Custom message input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (customMsgInput.trim()) {
                handleSendSignal(customMsgInput.trim());
                setCustomMsgInput('');
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={customMsgInput}
              onChange={(e) => setCustomMsgInput(e.target.value)}
              placeholder="Send custom note to stall..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600"
              aria-label="Custom message for kitchen"
            />
            <button
              type="submit"
              disabled={!customMsgInput.trim()}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>
      )}

      {/* TAB 4: RECEIPT & BREAKDOWN */}
      {activeTab === 'receipt' && (
        <section 
          aria-label="Order Receipt"
          className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-600" />
              <span>Digital Order Receipt</span>
            </h4>
            <span className="text-xs text-slate-500 font-medium">
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <VegBadge isVeg={item.isVeg} size="sm" />
                  <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                    {item.quantity}x
                  </span>
                  <span className="font-semibold text-slate-900">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">
                  ₹{item.price * item.quantity}
                </span>
              </div>
            ))}
          </div>

          {order.instructions && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <span className="font-bold text-slate-900">Cooking Note: </span>
              {order.instructions}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Total</span>
              <span>₹{order.subtotal}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Taxes & Stall Charges</span>
              <span className="text-emerald-600 font-bold">₹0 (Free)</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
              <span className="font-bold text-slate-800">Grand Total Paid</span>
              <span className="text-lg font-black text-slate-900">₹{order.total}</span>
            </div>
          </div>
        </section>
      )}

      {/* 5. INTERACTIVE TESTING & STALL SIMULATOR DOCK */}
      {/* Allows users and testers to experience real-time order lifecycle changes! */}
      <section 
        aria-label="Interactive Stall Counter Simulation Controls"
        className="p-4 rounded-3xl bg-slate-900 text-white shadow-lg border border-slate-800"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Stall Counter Simulation Deck
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-orange-300 border border-slate-700">
            Interactive Tester
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mb-3 leading-snug">
          Simulate stall counter updating this live order status in real time:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => advanceOrderStatus('ACCEPTED')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 ${
              order.orderStatus === 'ACCEPTED'
                ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            aria-pressed={order.orderStatus === 'ACCEPTED'}
          >
            1. Accept Slot
          </button>
          <button
            onClick={() => advanceOrderStatus('PREPARING')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 ${
              order.orderStatus === 'PREPARING'
                ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            aria-pressed={order.orderStatus === 'PREPARING'}
          >
            2. Cooking 🔥
          </button>
          <button
            onClick={() => advanceOrderStatus('READY')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              order.orderStatus === 'READY'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            aria-pressed={order.orderStatus === 'READY'}
          >
            3. Call Token 🔔
          </button>
          <button
            onClick={() => advanceOrderStatus('COMPLETED')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 ${
              order.orderStatus === 'COMPLETED'
                ? 'bg-slate-600 text-white ring-2 ring-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            aria-pressed={order.orderStatus === 'COMPLETED'}
          >
            4. Handover ✓
          </button>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => navigate(`/shop/${order.shopId}`)}
          className="flex-1 py-3 px-4 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs transition-colors shadow-xs"
        >
          Add More from Stall
        </button>
        <button
          onClick={() => navigate('/orders')}
          className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
        >
          View All Tokens & History
        </button>
      </div>

      {/* 6. QR SCANNER PASS MODAL */}
      {showPickupPassModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-pass-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setShowPickupPassModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span id="qr-pass-title" className="font-bold text-sm text-slate-900">
                Stall Counter Scanner Pass
              </span>
              <button 
                onClick={() => setShowPickupPassModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close scanner pass"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center">
              {/* Barcode representation */}
              <div className="font-mono text-4xl font-black tracking-widest text-slate-900 mb-2">
                {order.tokenNumber}
              </div>
              <div className="w-48 h-12 flex items-center justify-between px-2 bg-white rounded-lg border border-slate-300 mb-3">
                {/* Simulated barcode bars */}
                {[3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6].map((w, idx) => (
                  <div 
                    key={idx} 
                    className="bg-slate-900 h-8" 
                    style={{ width: `${(w % 3) + 1.5}px` }} 
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-700">
                Verification PIN: <strong className="font-mono text-orange-600 text-sm">{pickupPin}</strong>
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Present this pass at <strong className="text-slate-800">{order.shopName}</strong> counter scanner gun to collect your order without waiting.
            </p>

            <button
              onClick={() => setShowPickupPassModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}

      {/* 8. CUSTOMER ORDER CANCELLATION MODAL */}
      <CancelOrderModal
        order={order}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirmCancel={handleCustomerCancel}
      />
    </article>
  );
};
