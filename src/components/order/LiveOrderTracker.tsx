import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Order, OrderStatus, Shop } from '../../types';
import { orderService } from '../../services/orderService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { notificationService } from '../../services/notificationService';
import { shopService } from '../../services/shopService';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { isCustomerAuthorizedForOrder, maskPhoneNumber, canCustomerCancelOrder } from '../../utils/orderValidation';
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
  ShieldAlert,
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
import { ShopDirectionMap } from './ShopDirectionMap';
import { CancelOrderModal } from './CancelOrderModal';
import { OrderRatingReview } from './OrderRatingReview';
import { PostOrderFeedbackModal } from './PostOrderFeedbackModal';

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
  const { currentUser } = useAuth();
  const { highContrast, reducedMotion, announce } = useAccessibility();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPickupPassModal, setShowPickupPassModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'map' | 'receipt' | 'messages'>('timeline');
  const [shop, setShop] = useState<Shop | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const autoFeedbackPromptedRef = useRef<boolean>(false);
  const [isReadyTransitioning, setIsReadyTransitioning] = useState<boolean>(false);
  const prevStatusRef = useRef<OrderStatus | null>(null);

  // Customer quick signals sent to stall
  const [customerSignals, setCustomerSignals] = useState<Array<{ text: string; time: string; from: 'customer' | 'stall' }>>([
    { text: 'Order queued at stall counter. We will notify you once cooking starts.', time: 'Just now', from: 'stall' }
  ]);
  const [customMsgInput, setCustomMsgInput] = useState('');

  // Queue position calculation
  const [queueAheadCount, setQueueAheadCount] = useState<number>(0);
  const [currentServingToken, setCurrentServingToken] = useState<string>('#101');

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
      if (!orderId) {
        setOrder(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await orderService.getOrder(orderId);
      if (!data) {
        setOrder(null);
        setLoading(false);
        return;
      }

      // Customer Tenant Isolation: Verify viewer owns this order
      if (!isCustomerAuthorizedForOrder(data, currentUser)) {
        setIsUnauthorized(true);
        setOrder(null);
        setLoading(false);
        return;
      }
      setIsUnauthorized(false);

      // Verify that the shop for this order still exists in the database
      const liveShop = await shopService.getShop(data.shopId);
      if (!liveShop) {
        setOrder(null);
        setLoading(false);
        return;
      }

      setShop(liveShop);
      setOrder(data);
      setLoading(false);

      if (data) {
        // Accurate queue calculation starting at 101
        const tokenNum = parseInt(String(data.tokenNumber || '').replace(/\D/g, ''), 10) || 101;
        
        // Fetch active shop orders to get the exact real queue ahead
        orderService.getShopOrders(data.shopId).then((shopOrders) => {
          const activeAhead = shopOrders.filter(
            (o) =>
              o.id !== data.id &&
              ['PENDING', 'ACCEPTED', 'PREPARING'].includes(o.orderStatus) &&
              new Date(o.createdAt).getTime() < new Date(data.createdAt).getTime()
          );
          setQueueAheadCount(activeAhead.length);

          const calling = shopOrders.find((o) => o.orderStatus === 'READY' || o.orderStatus === 'PREPARING');
          if (calling) {
            setCurrentServingToken(calling.tokenNumber);
          } else if (tokenNum <= 101) {
            setCurrentServingToken('#101');
          } else {
            setCurrentServingToken(`#${Math.max(101, tokenNum - Math.max(1, activeAhead.length))}`);
          }
        }).catch(() => {
          const diff = Math.max(0, tokenNum - 101);
          setQueueAheadCount(diff);
          setCurrentServingToken(diff === 0 ? `#${tokenNum}` : `#${Math.max(101, tokenNum - 1)}`);
        });

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

  // Post-order feedback loop: automatically prompt rating modal when order is marked COMPLETED
  useEffect(() => {
    if (!order) return;
    if (order.orderStatus === 'COMPLETED' && !order.rating && !autoFeedbackPromptedRef.current) {
      autoFeedbackPromptedRef.current = true;
      const timer = setTimeout(() => {
        setShowFeedbackModal(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [order?.orderStatus, order?.rating]);

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
    const shareText = `FoodFax Order Token: ${order.tokenNumber} at ${order.shopName} | Status: ${order.orderStatus}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `FoodFax Token ${order.tokenNumber}`,
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

  if (isUnauthorized) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center bg-white rounded-3xl border border-amber-200/90 shadow-sm mt-4 space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900">Protected Order Token</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            This live order token belongs to another customer account. For security and privacy, you can only track orders placed in your session or registered account.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            onClick={() => navigate('/orders')}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            View Your Orders
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Back to Home
          </button>
        </div>
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

      {/* 1.05 PENDING UPI UTR VERIFICATION BANNER */}
      {!isCancelled && order.paymentMethod === 'PAY_ONLINE' && order.paymentStatus !== 'PAID' && (
        <section
          role="status"
          aria-live="polite"
          className="p-4 rounded-3xl bg-amber-50 border-2 border-amber-300 shadow-md space-y-2"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800 block">
                Stall UPI Verification Pending
              </span>
              <h3 className="text-sm font-black text-amber-950 leading-tight mt-0.5">
                Verifying 12-Digit UTR with {order.shopName}
              </h3>
              <p className="text-xs text-amber-900 font-medium mt-1">
                {order.utrNumber ? (
                  <>
                    Claimed UTR: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">{order.utrNumber}</strong>.
                  </>
                ) : null}{' '}
                The stall owner is matching your ₹{order.total} bank credit before starting preparation.
              </p>
            </div>
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
          <span className="text-[11px] sm:text-xs uppercase tracking-widest text-slate-500 font-extrabold block">
            Counter Token Number
          </span>
          <div 
            tabIndex={0}
            aria-label={`Token number ${order.tokenNumber}`}
            className="text-5xl sm:text-7xl font-black tracking-tight text-slate-900 font-mono my-0.5 select-all"
          >
            {order.tokenNumber}
          </div>
        </div>

        {/* 4-Digit Security PIN & Barcode Simulator */}
        <div className="relative z-10 inline-flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 my-2 flex-wrap justify-center">
          <span className="text-slate-500 font-medium">Pickup PIN:</span>
          <span className="font-mono font-black text-slate-900 text-sm tracking-wider">{pickupPin}</span>
          <span className="text-slate-300 hidden xs:inline">|</span>
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
          <span
            className={`font-semibold px-2 py-0.5 rounded-md ${
              order.paymentMethod === 'CASH_AT_COUNTER'
                ? order.paymentStatus === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
                : order.paymentStatus === 'PAID'
                ? 'bg-emerald-100 text-emerald-800'
                : order.paymentStatus === 'FAILED'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {order.paymentMethod === 'CASH_AT_COUNTER'
              ? order.paymentStatus === 'PAID'
                ? 'Cash Paid ✓'
                : 'Cash at Counter'
              : order.paymentStatus === 'PAID'
              ? 'UPI Verified & Paid ✓'
              : order.paymentStatus === 'FAILED'
              ? 'UPI Verification Failed ✕'
              : '⏳ UPI UTR Verifying...'}
          </span>
        </div>

        {/* Quick Toolbar */}
        <div className="relative z-10 mt-4 grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 w-full">
          <button
            onClick={playVoiceAnnouncement}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-600 active:scale-95"
            aria-label="Speak order token announcement using text to speech"
          >
            <Volume2 className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <span className="truncate">{isSpeaking ? 'Speaking...' : 'Voice Call'}</span>
          </button>

          {/* Status animation trigger button for testing & replay */}
          <button
            onClick={triggerReadyAnimation}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors border border-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-95"
            title="Preview the subtle status update transition animation"
            aria-label="Preview ready status animation"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="truncate">{isReadyTransitioning ? 'Updating...' : 'Ready Alert'}</span>
          </button>

          <button
            onClick={handleShareToken}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-600 active:scale-95"
            aria-label="Share token with friend or save to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <Share2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
            <span className="truncate">{copied ? 'Copied!' : 'Share'}</span>
          </button>

          <button
            onClick={printReceipt}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-600 active:scale-95"
            aria-label="Print or save digital counter receipt"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            <span className="truncate">Print Pass</span>
          </button>

          {/* Cancellation Trigger & Kitchen Acceptance Lock Notice */}
          {!isCancelled && !isCompleted && (
            canCustomerCancelOrder(order.orderStatus) ? (
              <button
                onClick={() => setShowCancelModal(true)}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors border border-red-200 focus-visible:ring-2 focus-visible:ring-red-600 active:scale-95 cursor-pointer"
                aria-label="Cancel this order and claim full refund"
              >
                <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                <span>Cancel (100% Refund)</span>
              </button>
            ) : (
              <div className="col-span-2 sm:col-span-3 flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-600 text-[11px] leading-snug">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
                <span>
                  <strong>Kitchen Accepted:</strong> Food preparation has begun. Cancellations and refunds are locked per FoodFax Stall Policy.
                </span>
              </div>
            )
          )}
        </div>
      </section>

      {/* 2.1 COMPLETED ORDER STAR RATING & REVIEW CARD */}
      {isCompleted && (
        <section aria-label="Customer Review and Rating Feedback" className="animate-in fade-in slide-in-from-top-3 duration-300">
          {!order.rating && (
            <div className="mb-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Star className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">Food Collected! How was your stall experience?</p>
                  <p className="text-[11px] text-slate-600">Rate your food, service speed & packaging below.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <Star className="w-3.5 h-3.5 fill-white" />
                  <span>Rate Experience</span>
                </button>
                <div className="hidden sm:flex items-center gap-0.5 text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                </div>
              </div>
            </div>
          )}
          <OrderRatingReview
            order={order}
            onReviewSubmitted={(updated) => {
              setOrder(updated);
              announce('Thank you! Your feedback has been sent to the food stall.', 'polite');
            }}
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
        className="grid grid-cols-4 p-1 bg-slate-200/70 rounded-2xl text-[11px] sm:text-xs font-bold text-slate-700 gap-1 w-full"
      >
        <button
          onClick={() => setActiveTab('timeline')}
          className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
            activeTab === 'timeline'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-selected={activeTab === 'timeline'}
          role="tab"
        >
          <span className="hidden sm:inline">Live </span>Pipeline
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
            activeTab === 'map'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-selected={activeTab === 'map'}
          role="tab"
        >
          Directions
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
            activeTab === 'messages'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-selected={activeTab === 'messages'}
          role="tab"
        >
          Signals ({customerSignals.length})
        </button>
        <button
          onClick={() => setActiveTab('receipt')}
          className={`py-2 px-1 rounded-xl transition-all truncate text-center ${
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
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <span>Live Directions to {order.shopName}</span>
            </h4>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
              Live GPS
            </span>
          </div>

          {/* ShopDirectionMap: Customer live GPS + shop pin + Routes API v2 route polyline */}
          <ShopDirectionMap
            shopName={order.shopName}
            shopLatitude={shop?.latitude || shop?.location?.latitude || 19.3515}
            shopLongitude={shop?.longitude || shop?.location?.longitude || 72.8525}
            shopAddress={shop?.location?.address || shop?.address || order.shopLocation}
            height="h-64"
          />

          {/* Counter Pickup Details */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Pickup Counter:</span>
              <span className="font-bold text-slate-900 dark:text-white">Window 1 (Online Orders Fast-Track)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Stall Contact:</span>
              <span className="font-bold text-slate-900 dark:text-white">{shop?.phone || '+91 98921 77880'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Dine-in / Seating:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {shop?.tableServiceAvailable ? 'Available behind counter' : 'Counter pickup only'}
              </span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <a
              href={`tel:${shop?.phone || '+919892177880'}`}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-600"
            >
              <Phone className="w-4 h-4 text-slate-600 dark:text-slate-300" />
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
            {order.utrNumber && (
              <div className="flex justify-between text-slate-600">
                <span>UPI Reference (UTR)</span>
                <span className="font-mono font-bold text-slate-900">{order.utrNumber}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
              <span className="font-bold text-slate-800">
                {order.paymentStatus === 'PAID'
                  ? 'Grand Total Paid ✓'
                  : order.paymentMethod === 'CASH_AT_COUNTER'
                  ? 'Total Payable at Counter'
                  : 'Total (Pending Stall Verification)'}
              </span>
              <span className="text-lg font-black text-slate-900">₹{order.total}</span>
            </div>
          </div>
        </section>
      )}

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

      {/* 9. POST-ORDER CUSTOMER FEEDBACK & RATING MODAL */}
      <PostOrderFeedbackModal
        order={order}
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onFeedbackSubmitted={(updated) => {
          setOrder(updated);
          announce('Thank you! Your feedback has been sent to the food stall.', 'polite');
        }}
      />
    </article>
  );
};
