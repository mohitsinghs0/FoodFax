import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { shopService } from '../services/shopService';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { recordPlacedOrder } from '../utils/orderValidation';
import { OrderType, PaymentMethod, Shop, UPIQRPayCreateResponse } from '../types';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Clock, 
  Store, 
  CheckCircle2, 
  CreditCard, 
  Banknote, 
  Utensils, 
  ShoppingBag,
  Sparkles,
  QrCode,
  Smartphone,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  X,
  Check
} from 'lucide-react';

// FoodFax Central Platform Merchant Details (All stalls route here; owners collect payout from platform)
export const PLATFORM_UPI_ID = 'bharatpe2e0p0d8x5a59798@unitype';
export const PLATFORM_MERCHANT_NAME = 'Mohit Santosh Singh';

export const CheckoutView: React.FC = () => {
  const { navigate, goBack } = useRouter();
  const { currentUser, isAuthenticated, isLoading } = useAuth();
  const { items, shopId, shopName, shopImage, subtotal, commitOrderAndClearCart } = useCart();

  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PAY_ONLINE');
  const [instructions, setInstructions] = useState('');
  const [customerName, setCustomerName] = useState(currentUser?.fullName || currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shopDetails, setShopDetails] = useState<Shop | null>(null);

  // UPI Payment Gateway Modal State (UPIQRPay Connected to BharatPe Business)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [upiData, setUpiData] = useState<UPIQRPayCreateResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'WAITING' | 'PAID' | 'REJECTED' | 'EXPIRED'>('WAITING');
  const [paymentUtr, setPaymentUtr] = useState<string | null>(null);
  const [paymentCountdown, setPaymentCountdown] = useState<number>(300); // 5 minutes
  const [isVerifying, setIsVerifying] = useState(false);
  const [merchantNotice, setMerchantNotice] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string>('');
  const [statusCheckMsg, setStatusCheckMsg] = useState<string | null>(null);
  const [manualUtr, setManualUtr] = useState('');
  const [showUtrInput, setShowUtrInput] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCommittingRef = useRef<boolean>(false);
  const cartItemsSnapshotRef = useRef<{ menuItem: any; quantity: number }[]>([]);

  // Guard: if unauthenticated, redirect to login with return to /checkout
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !currentUser) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('foodfax_post_login_redirect', '/checkout');
      }
      navigate('/login?redirect=/checkout');
    }
  }, [isLoading, isAuthenticated, currentUser, navigate]);

  // Synchronize customer profile info when logged in user is loaded
  useEffect(() => {
    if (currentUser) {
      const name = currentUser.fullName || currentUser.name;
      if (name) setCustomerName(name);
      if (currentUser.phone) setCustomerPhone(currentUser.phone);
    }
  }, [currentUser]);

  useEffect(() => {
    if (shopId) {
      shopService.getShop(shopId).then((s) => {
        if (s) {
          setShopDetails(s);
          if (s.isOnlinePaymentEnabled === false) {
            setPaymentMethod('CASH_AT_COUNTER');
          }
        }
      });
    }
  }, [shopId]);

  // Payment Countdown Timer & Automatic UPIQRPay Gateway Polling Listener
  useEffect(() => {
    if (!isPaymentModalOpen || paymentStatus === 'PAID' || paymentStatus === 'REJECTED') {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    if (paymentStatus === 'WAITING') {
      setPaymentCountdown(300);
      countdownTimerRef.current = setInterval(() => {
        setPaymentCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current as NodeJS.Timeout);
            setPaymentStatus('EXPIRED');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Automatically poll UPIQRPay Gateway every 2 seconds for bank confirmation
    const pollInterval = setInterval(async () => {
      if (upiData?.paymentId && paymentStatus === 'WAITING' && !isCommittingRef.current) {
        try {
          const res = await paymentService.checkPaymentStatus(upiData.paymentId, shopId || undefined);
          const statusUpper = String(res?.data?.status || '').toUpperCase();
          if (statusUpper === 'PAID' || statusUpper === 'SUCCESS') {
            clearInterval(pollInterval);
            await handleGatewayConfirmedPayment(res?.data?.utrNumber || upiData.paymentId);
          } else if (statusUpper === 'EXPIRED' || statusUpper === 'CANCELLED') {
            setPaymentStatus('EXPIRED');
            clearInterval(pollInterval);
          }
        } catch {}
      }
    }, 2000);

    // Realtime subscription for webhook updates on public.payments / public.orders
    let unsubscribeRealtime: (() => void) | undefined;
    if (pendingOrderId && paymentStatus === 'WAITING') {
      unsubscribeRealtime = paymentService.subscribeToPaymentUpdates(
        pendingOrderId,
        async (newStatus, utr) => {
          if (newStatus === 'PAID' && !isCommittingRef.current) {
            await handleGatewayConfirmedPayment(utr || upiData?.paymentId || 'UPI-VERIFIED');
          }
        }
      );
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      clearInterval(pollInterval);
      if (unsubscribeRealtime) unsubscribeRealtime();
    };
  }, [isPaymentModalOpen, upiData?.paymentId, paymentStatus, pendingOrderId, shopId, navigate]);

  if (isLoading && !currentUser) {
    return (
      <div className="py-20 px-4 max-w-md mx-auto text-center">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-500">Checking your account...</p>
      </div>
    );
  }

  if (items.length === 0 && !isPaymentModalOpen) {
    return (
      <div className="py-20 px-4 max-w-md mx-auto text-center">
        <h2 className="text-xl font-black text-slate-900 mb-2">No items in cart</h2>
        <p className="text-xs text-slate-500 mb-6">Add items from a food stall first.</p>
        <button
          onClick={() => navigate('/shops')}
          className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-orange-600 cursor-pointer"
        >
          Browse Stalls
        </button>
      </div>
    );
  }

  const grandTotal = subtotal;

  // Online UPI is enabled via UPIQRPay (connected to BharatPe Business)
  const shopHasUpi = shopDetails ? shopDetails.isOnlinePaymentEnabled !== false : true;

  const activeQrCodeUrl = upiData?.qrCode || '';
  const activeUpiLink = upiData?.upiLink || '';
  // STRICT PRICING INTEGRITY: Never alter customer price with random paise (1.01, 1.02, 1.03, 1.04)
  const payableAmount = grandTotal;

  /**
   * Builds app-specific deep links for Google Pay, PhonePe, Paytm, or generic UPI.
   * Following Google Pay / NPCI official specs: includes merchant VPA (pa), payee name (pn),
   * exact order payable amount formatted with 2 decimals (am), currency (cu=INR),
   * transaction reference (tr) linked to the gateway order ID, and note (tn).
   */
  const getUpiAppHref = (app: 'gpay' | 'phonepe' | 'paytm' | 'bhim'): string => {
    const formattedAmount = (grandTotal || 0).toFixed(2);
    const txnRef = pendingOrderId || upiData?.orderId || `ord-${Date.now()}`;
    const txnNote = `FoodFax Order ${txnRef}`;
    const merchantPa = PLATFORM_UPI_ID;
    const merchantPn = PLATFORM_MERCHANT_NAME;

    // Standard percent-encoded query (%20 instead of +) so Google Pay / PhonePe parse cleanly
    const upiQuery = [
      `pa=${encodeURIComponent(merchantPa)}`,
      `pn=${encodeURIComponent(merchantPn)}`,
      `am=${formattedAmount}`,
      `cu=INR`,
      `tn=${encodeURIComponent(txnNote)}`,
      `tr=${encodeURIComponent(txnRef)}`,
    ].join('&');

    const isMobile =
      typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile && upiData?.payUrl && upiData.payUrl !== '#') {
      return upiData.payUrl;
    }

    if (app === 'gpay') return `tez://upi/pay?${upiQuery}`;
    if (app === 'phonepe') return `phonepe://pay?${upiQuery}`;
    if (app === 'paytm') return `paytmmp://pay?${upiQuery}`;
    return `upi://pay?${upiQuery}`;
  };

  const validateOrderInputs = () => {
    if (!isAuthenticated || !currentUser) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('foodfax_post_login_redirect', '/checkout');
      }
      navigate('/login?redirect=/checkout');
      return false;
    }

    if (!shopId) return false;
    if (orderType === 'DINE_IN' && !tableNumber.trim()) {
      setErrorMessage('Please enter your table number for Dine-In orders.');
      return false;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Please enter your contact phone number.');
      return false;
    }
    return true;
  };

  /**
   * Called when customer clicks "Pay with UPI" or "Place Order with Cash"
   */
  const handlePlaceOrder = async () => {
    if (!validateOrderInputs()) return;

    setErrorMessage(null);
    setMerchantNotice(null);
    setStatusCheckMsg(null);

    // Snapshot cart items so they are permanently preserved for order commit
    if (items && items.length > 0) {
      cartItemsSnapshotRef.current = items.map((it) => ({ ...it }));
    }

    const effectiveShopId = shopDetails?.id || shopId!;

    // If Cash at Counter: Immediately commit order and route to live tracker
    if (paymentMethod === 'CASH_AT_COUNTER') {
      setIsSubmitting(true);
      try {
        const sourceItems = items && items.length > 0 ? items : cartItemsSnapshotRef.current;
        const orderItems = sourceItems.map(({ menuItem, quantity }) => ({
          id: `item-${Date.now()}-${menuItem.id}`,
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity,
          isVeg: menuItem.isVeg,
        }));

        const orderSubtotal = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);
        const orderTotal = grandTotal || orderSubtotal;

        const newOrder = await commitOrderAndClearCart({
          shopId: effectiveShopId,
          shopName: shopName || shopDetails?.name || 'Food Stall',
          shopImage: shopImage || shopDetails?.image || undefined,
          shopLocation: shopDetails?.location?.address || shopDetails?.location?.landmark || 'Counter Stall',
          customerId: currentUser?.id,
          customerName: customerName.trim() || currentUser?.fullName || currentUser?.name || 'FoodFax Customer',
          customerPhone: customerPhone.trim() || currentUser?.phone || '',
          orderType,
          tableNumber: orderType === 'DINE_IN' ? tableNumber.trim() : undefined,
          paymentMethod: 'CASH_AT_COUNTER',
          items: orderItems,
          subtotal: orderSubtotal,
          total: orderTotal,
          estimatedPreparationMinutes: '5-10',
          instructions: instructions.trim() || undefined,
        });

        recordPlacedOrder(newOrder.id);
        navigate(`/order/${newOrder.id}`);
      } catch (err: any) {
        console.error('Failed to place counter order:', err);
        setErrorMessage(err?.message || 'Could not place order. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // IF PAY ONLINE (Central Platform Merchant & UPI Gateway):
    // 1. DO NOT commit or save the order yet! Cart remains intact until payment is verified.
    const tempTxnRef = `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    setPendingOrderId(tempTxnRef);
    isCommittingRef.current = false;
    setPaymentStatus('WAITING');
    setPaymentUtr(null);
    setErrorMessage(null);

    // 2. Central Platform Merchant Policy: Mohit Santosh Singh (BharatPe UPI ID)
    const targetUpiId = (shopDetails?.enableDirectMerchant && shopDetails?.upiId)
      ? shopDetails.upiId
      : PLATFORM_UPI_ID;
    const targetShopName = (shopDetails?.enableDirectMerchant && shopDetails?.name)
      ? shopDetails.name
      : PLATFORM_MERCHANT_NAME;
    const orderNote = `FoodFax Order ${tempTxnRef}`;
    const formattedAmount = (grandTotal || 0).toFixed(2);
    const instantUpiLink = `upi://pay?pa=${encodeURIComponent(targetUpiId)}&pn=${encodeURIComponent(targetShopName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(orderNote)}&tr=${encodeURIComponent(tempTxnRef)}`;
    const instantQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(instantUpiLink)}`;

    // 3. Open modal INSTANTLY (0ms delay) with exact order amount
    setUpiData({
      paymentId: tempTxnRef,
      orderId: tempTxnRef,
      amount: grandTotal,
      qrCode: instantQrCode,
      upiLink: instantUpiLink,
      payUrl: instantUpiLink,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      status: 'pending',
    });
    setIsPaymentModalOpen(true);
    setIsSubmitting(false);

    // 4. Background registration with UPIQRPay for automatic webhook / polling settlement
    paymentService.createUpiOrder({
      orderId: tempTxnRef,
      customerPhone: customerPhone.trim(),
      customerName: customerName.trim(),
      amount: grandTotal,
      shopId: effectiveShopId,
    }).then((upiResult) => {
      if (upiResult.success && upiResult.data) {
        setUpiData((prev) => ({
          ...prev!,
          ...upiResult.data,
          // Strictly enforce original cart amount (prevent arbitrary paise override)
          amount: grandTotal,
        }));
      }
    }).catch(() => {});
  };

  /**
   * Called automatically when UPIQRPay gateway confirms payment via bank status/webhook
   */
  const handleGatewayConfirmedPayment = async (utrString: string) => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    setIsVerifying(true);
    setPaymentStatus('PAID');
    setPaymentUtr(utrString);

    try {
      const sourceItems = items && items.length > 0 ? items : cartItemsSnapshotRef.current;
      const orderItems = sourceItems.map(({ menuItem, quantity }) => ({
        id: `item-${Date.now()}-${menuItem.id}`,
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        isVeg: menuItem.isVeg,
      }));

      const orderSubtotal = orderItems.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);
      const orderTotal = grandTotal || orderSubtotal;
      const effectiveShopId = shopDetails?.id || shopId!;

      // NOW AND ONLY NOW: Commit the verified order and clear the cart!
      const newOrder = await commitOrderAndClearCart({
        id: pendingOrderId || undefined,
        shopId: effectiveShopId,
        shopName: shopName || shopDetails?.name || 'Food Stall',
        shopImage: shopImage || shopDetails?.image || undefined,
        shopLocation: shopDetails?.location?.address || shopDetails?.location?.landmark || 'Counter Stall',
        customerId: currentUser?.id,
        customerName: customerName.trim() || currentUser?.fullName || currentUser?.name || 'FoodFax Customer',
        customerPhone: customerPhone.trim() || currentUser?.phone || '',
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber.trim() : undefined,
        paymentMethod: 'PAY_ONLINE',
        paymentStatus: 'PAID',
        utrNumber: utrString,
        items: orderItems,
        subtotal: orderSubtotal,
        total: orderTotal,
        estimatedPreparationMinutes: '5-10',
        instructions: instructions.trim() || undefined,
      });

      recordPlacedOrder(newOrder.id);

      setTimeout(() => {
        setIsPaymentModalOpen(false);
        navigate(`/order/${newOrder.id}`);
      }, 1400);
    } catch (err: any) {
      console.error('Error committing gateway verified order:', err);
      isCommittingRef.current = false;
      setErrorMessage(err?.message || 'Error confirming order. Please contact counter staff.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Manual one-click status check (no UTR input required!) — polls UPIQRPay server immediately
   */
  const handleCheckPaymentNow = async () => {
    const targetId = pendingOrderId || upiData?.paymentId;
    if (!targetId) return;
    setIsVerifying(true);
    setStatusCheckMsg(null);
    try {
      const res = await paymentService.checkPaymentStatus(targetId, shopId || undefined);
      const statusUpper = String(res?.data?.status || '').toUpperCase();
      if (statusUpper === 'PAID' || statusUpper === 'SUCCESS') {
        await handleGatewayConfirmedPayment(res?.data?.utrNumber || targetId);
      } else {
        setStatusCheckMsg(
          'Waiting for bank settlement... If your payment is done, click "Enter 12-digit UPI Reference / UTR Number" below for instant confirmation.'
        );
      }
    } catch {
      setStatusCheckMsg('Checking with UPI gateway... You can also submit the 12-digit UTR below.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Allows customer to confirm immediately with 12-digit UPI UTR if bank debited but gateway polling is delayed
   */
  const handleManualUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUtr.trim()) {
      setUtrError('Please enter your 12-digit UPI Reference / UTR Number.');
      return;
    }
    setUtrError(null);
    setIsVerifying(true);
    try {
      const result = await paymentService.verifyAndValidateUtr({
        utrNumber: manualUtr.trim(),
        orderId: pendingOrderId || upiData?.orderId,
        paymentId: upiData?.paymentId,
      });

      if (!result.valid) {
        setUtrError(result.error || 'Invalid 12-digit UPI UTR number.');
        return;
      }

      await handleGatewayConfirmedPayment(result.cleanedUtr);
    } catch (err: any) {
      setUtrError(err?.message || 'Verification failed. Please retry.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Switch back to Cash at Counter from the modal
   */
  const handleSwitchToCash = () => {
    setPaymentMethod('CASH_AT_COUNTER');
    setIsPaymentModalOpen(false);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 max-w-3xl mx-auto space-y-4 sm:space-y-5 pb-28 overflow-x-hidden min-w-0">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate">Checkout & Token Confirmation</h1>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Stall: <strong className="text-slate-800">{shopName}</strong>
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          {errorMessage}
        </div>
      )}

      {/* 1. Order Type Selection */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3">
        <h2 className="font-bold text-sm text-slate-900">1. Select Order Type</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setOrderType('TAKEAWAY')}
            className={`p-3 sm:p-3.5 rounded-xl border-2 text-left transition-all min-w-0 cursor-pointer ${
              orderType === 'TAKEAWAY'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 min-w-0">
              <ShoppingBag className={`w-4 h-4 flex-shrink-0 ${orderType === 'TAKEAWAY' ? 'text-orange-600' : 'text-slate-500'}`} />
              <span className="font-bold text-xs sm:text-sm truncate">Takeaway / Parcel</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">Pick up at counter when ready</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderType('DINE_IN')}
            className={`p-3 sm:p-3.5 rounded-xl border-2 text-left transition-all min-w-0 cursor-pointer ${
              orderType === 'DINE_IN'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 min-w-0">
              <Utensils className={`w-4 h-4 flex-shrink-0 ${orderType === 'DINE_IN' ? 'text-orange-600' : 'text-slate-500'}`} />
              <span className="font-bold text-xs sm:text-sm truncate">Dine-in Table</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">Served right to your table</p>
          </button>
        </div>

        {orderType === 'DINE_IN' && (
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Table / Counter Seat Number *
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. Table 4, Counter Seat 2"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* 2. Customer Info */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <h2 className="font-bold text-sm text-slate-900">2. Customer Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Cooking Instructions (Optional)
          </label>
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Extra chutney, less spicy, well toasted"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Payment Preference Selection */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900">3. Select Payment Method</h2>
          {shopHasUpi && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              UPI QR &amp; Mobile App
            </span>
          )}
        </div>

        {/* Warning: shown only when shop has no UPI ID registered */}
        {!shopHasUpi && shopDetails && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-amber-800 leading-tight">
              This stall hasn&apos;t added a UPI ID yet. Only Cash at Stall is available.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Option A: UPI / Online */}
          <button
            type="button"
            disabled={!shopHasUpi}
            onClick={() => shopHasUpi && setPaymentMethod('PAY_ONLINE')}
            className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all min-w-0 relative ${
              !shopHasUpi
                ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                : paymentMethod === 'PAY_ONLINE'
                ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-md ring-2 ring-emerald-500/20 cursor-pointer'
                : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <QrCode className={`w-4.5 h-4.5 ${!shopHasUpi ? 'text-slate-300' : paymentMethod === 'PAY_ONLINE' ? 'text-emerald-700' : 'text-slate-500'}`} />
                <span className="font-black text-xs sm:text-sm">UPI Online</span>
              </div>
              <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center ${
                !shopHasUpi ? 'border-slate-200 bg-slate-100' : paymentMethod === 'PAY_ONLINE' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
              }`}>
                {paymentMethod === 'PAY_ONLINE' && shopHasUpi && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 leading-tight">
              GPay, PhonePe, Paytm, QR
            </p>
            {shopHasUpi ? (
              <>
                <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  Auto-Verify • Instant Token
                </span>
                <span className={`block mt-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  paymentMethod === 'PAY_ONLINE' ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-100 text-slate-500'
                }`}>
                  Pay Online Now
                </span>
              </>
            ) : (
              <span className="block mt-1.5 text-[9px] font-semibold text-slate-400">Not available</span>
            )}
          </button>

          {/* Option B: Cash at Counter */}
          <button
            type="button"
            onClick={() => setPaymentMethod('CASH_AT_COUNTER')}
            className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all min-w-0 cursor-pointer relative ${
              paymentMethod === 'CASH_AT_COUNTER'
                ? 'border-orange-500 bg-orange-50/70 text-orange-950 shadow-md ring-2 ring-orange-500/20'
                : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Banknote className={`w-4.5 h-4.5 ${paymentMethod === 'CASH_AT_COUNTER' ? 'text-orange-600' : 'text-slate-500'}`} />
                <span className="font-black text-xs sm:text-sm">Cash at Stall</span>
              </div>
              <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === 'CASH_AT_COUNTER' ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
              }`}>
                {paymentMethod === 'CASH_AT_COUNTER' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-600 leading-tight">
              Pay physical cash at counter
            </p>
            <span className={`inline-block mt-2 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              paymentMethod === 'CASH_AT_COUNTER' ? 'bg-orange-200/80 text-orange-900' : 'bg-slate-100 text-slate-500'
            }`}>
              Pay Later
            </span>
          </button>
        </div>
      </div>

      {/* Order Summary & Token Generator CTA */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Items in Order ({items.length})</span>
          <span className="font-bold text-slate-900">₹{grandTotal}</span>
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-black text-slate-900">
          <span>Grand Total</span>
          <span className="text-base text-orange-600">₹{grandTotal}</span>
        </div>
      </div>

      {/* Main Action Button */}
      <div>
        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={isSubmitting}
          className={`w-full py-4 px-6 rounded-2xl font-black text-base shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-white active:scale-[0.99] ${
            paymentMethod === 'PAY_ONLINE'
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
              : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25'
          } disabled:bg-slate-300`}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Connecting Payment Gateway...</span>
            </>
          ) : paymentMethod === 'PAY_ONLINE' ? (
            <>
              <QrCode className="w-5 h-5" />
              <span>Pay ₹{grandTotal} with UPI & Get Token</span>
            </>
          ) : (
            <>
              <Banknote className="w-5 h-5" />
              <span>Place Order with Cash (Pay ₹{grandTotal} at Counter)</span>
            </>
          )}
        </button>

        <p className="text-center text-xs mt-2 font-medium text-slate-500">
          {paymentMethod === 'PAY_ONLINE'
            ? '🔒 Opens UPI App (GPay/PhonePe/Paytm) or shows QR Code to pay'
            : '💵 Token generated now — pay physical cash to the shopkeeper when your token is called'}
        </p>
      </div>

      {/* ==================================================================== */}
      {/* UPI SCAN & PAY MODAL (UPIQRPay Dynamic Gateway)                     */}
      {/* ==================================================================== */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col p-4 sm:p-5 space-y-3.5 max-h-[95vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Scan & Pay via UPI</h3>
                  <p className="text-[10px] text-slate-500 truncate max-w-[190px]">Stall: {shopName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. PAID / VERIFIED SCREEN (Shown automatically when UPIQRPay confirms payment) */}
            {paymentStatus === 'PAID' ? (
              <div className="py-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-base font-black text-emerald-700">Payment Verified Automatically!</h4>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    {paymentUtr ? `Bank Reference / UTR: ${paymentUtr}` : 'Confirmed via UPIQRPay Gateway'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  Order token generated! Redirecting to live order tracker...
                </div>
              </div>
            ) : paymentStatus === 'EXPIRED' ? (
              /* 2. EXPIRED SCREEN */
              <div className="py-5 text-center space-y-3.5 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Clock className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="text-base font-black text-amber-800">Payment Session Expired</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    This dynamic QR code has expired. Click below to generate a fresh QR code.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                >
                  Generate New UPI QR
                </button>
              </div>
            ) : isSubmitting ? (
              /* 3. LOADING DYNAMIC GATEWAY QR */
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <h4 className="text-sm font-black text-slate-900">Generating Dynamic UPI Payment...</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connecting to BharatPe / UPIQRPay for automatic verification
                  </p>
                </div>
              </div>
            ) : !upiData ? (
              /* 4A. GATEWAY INITIALIZATION ERROR / RETRY */
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Could Not Load UPI Gateway QR</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {merchantNotice || 'Unable to generate BharatPe / UPIQRPay dynamic QR right now.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Retry Generating UPI Payment
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToCash}
                  className="w-full py-1.5 text-center text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
                >
                  Prefer to pay at counter? Switch to Cash
                </button>
              </div>
            ) : (
              /* 4B. ACTIVE UPI GATEWAY SCREEN (Direct GPay / PhonePe / Paytm + Dynamic QR + Auto-Verify) */
              <div className="space-y-3.5">
                {/* Stall & Amount Header Card */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Exact Amount To Pay</span>
                    <span className="text-xl font-black text-slate-900">₹{payableAmount}</span>
                    <span className="block text-[10px] font-semibold text-emerald-700 mt-0.5">
                      ✓ BharatPe / UPIQRPay Auto-Verify Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-slate-700 shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{formatSeconds(paymentCountdown)}</span>
                  </div>
                </div>

                {merchantNotice && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-800">
                    {merchantNotice}
                  </div>
                )}

                {/* Direct 1-Tap UPI Apps Grid (GPay, PhonePe, Paytm, BHIM) */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Pay ₹{payableAmount} Directly with UPI App
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={getUpiAppHref('gpay')}
                      target={upiData?.payUrl && typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '_blank' : undefined}
                      rel="noreferrer"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 bg-white transition-all shadow-2xs cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        G
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-slate-900 truncate">Google Pay</span>
                        <span className="block text-[9px] text-slate-500">Pay ₹{payableAmount} • Auto-Verify</span>
                      </div>
                    </a>

                    <a
                      href={getUpiAppHref('phonepe')}
                      target={upiData?.payUrl && typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '_blank' : undefined}
                      rel="noreferrer"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/40 bg-white transition-all shadow-2xs cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        Pe
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-slate-900 truncate">PhonePe</span>
                        <span className="block text-[9px] text-slate-500">Pay ₹{payableAmount} • Auto-Verify</span>
                      </div>
                    </a>

                    <a
                      href={getUpiAppHref('paytm')}
                      target={upiData?.payUrl && typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '_blank' : undefined}
                      rel="noreferrer"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/40 bg-white transition-all shadow-2xs cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                        Paytm
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-slate-900 truncate">Paytm UPI</span>
                        <span className="block text-[9px] text-slate-500">Pay ₹{payableAmount} • Auto-Verify</span>
                      </div>
                    </a>

                    <a
                      href={getUpiAppHref('bhim')}
                      target={upiData?.payUrl && typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '_blank' : undefined}
                      rel="noreferrer"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 bg-white transition-all shadow-2xs cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                        UPI
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-slate-900 truncate">Any UPI App</span>
                        <span className="block text-[9px] text-slate-500">Pay ₹{payableAmount} • Auto-Verify</span>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Dynamic QR Code Box */}
                {activeQrCodeUrl && (
                  <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex flex-col items-center justify-center relative">
                    <img
                      src={activeQrCodeUrl}
                      alt="UPI Payment QR Code"
                      className="w-44 h-44 sm:w-48 sm:h-48 rounded-xl object-contain bg-white p-2 shadow-xs border border-slate-200"
                    />
                    <div className="mt-2 text-center">
                      <p className="text-[11px] font-bold text-slate-700">Or Scan QR with Google Pay / PhonePe / Paytm</p>
                      <p className="text-[10px] text-slate-400">
                        Amount ₹{payableAmount} is pre-filled • Auto-detects payment in 2–3 seconds
                      </p>
                    </div>
                  </div>
                )}

                {/* Live Automatic Verification Status Bar */}
                <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200/80 space-y-2">
                  <div className="flex items-center gap-2.5 text-xs text-blue-950">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                    </span>
                    <span className="text-[11px] font-bold leading-snug">
                      Waiting for payment... Order will be placed automatically once you pay in GPay / PhonePe / Paytm.
                    </span>
                  </div>

                  {statusCheckMsg && (
                    <p className="text-[10px] font-semibold text-blue-800 bg-white/80 p-2 rounded-lg border border-blue-200">
                      {statusCheckMsg}
                    </p>
                  )}

                  {upiData?.paymentId && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleCheckPaymentNow}
                        disabled={isVerifying}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Checking Bank Status...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>I Have Paid — Check Status Now</span>
                          </>
                        )}
                      </button>

                      {!showUtrInput ? (
                        <button
                          type="button"
                          onClick={() => setShowUtrInput(true)}
                          className="w-full text-center text-[11px] font-bold text-blue-700 hover:underline cursor-pointer py-1"
                        >
                          Money deducted from bank? Enter 12-digit UTR to confirm instantly →
                        </button>
                      ) : (
                        <form onSubmit={handleManualUtrSubmit} className="space-y-2 pt-2 border-t border-blue-200">
                          <label className="block text-[10px] font-bold text-slate-700">
                            Enter 12-Digit UPI Reference / UTR Number (from GPay / PhonePe):
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={12}
                              value={manualUtr}
                              onChange={(e) => setManualUtr(e.target.value.replace(/\D/g, ''))}
                              placeholder="e.g. 429612345678"
                              className="flex-1 px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                            />
                            <button
                              type="submit"
                              disabled={isVerifying || manualUtr.length < 12}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                            >
                              Verify UTR
                            </button>
                          </div>
                          {utrError && (
                            <p className="text-[10px] font-semibold text-rose-600">{utrError}</p>
                          )}
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {/* Switch to Cash Option */}
                <button
                  type="button"
                  onClick={handleSwitchToCash}
                  className="w-full py-1.5 text-center text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
                >
                  Prefer to pay at counter? Switch to Cash
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
