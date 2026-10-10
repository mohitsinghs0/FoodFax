import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { shopService } from '../services/shopService';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
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

  // UPI Payment Gateway Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [upiData, setUpiData] = useState<UPIQRPayCreateResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    'WAITING' | 'VERIFYING_WITH_STALL' | 'PAID' | 'REJECTED' | 'EXPIRED'
  >('WAITING');
  const [paymentUtr, setPaymentUtr] = useState<string | null>(null);
  const [paymentCountdown, setPaymentCountdown] = useState<number>(300); // 5 minutes
  const [isVerifying, setIsVerifying] = useState(false);
  const [merchantNotice, setMerchantNotice] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string>('');
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const [submittedTokenNumber, setSubmittedTokenNumber] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [manualUtrInput, setManualUtrInput] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          // Auto-switch to cash if this shop has no UPI ID registered
          if (!s.upiId?.trim()) {
            setPaymentMethod('CASH_AT_COUNTER');
          }
        }
      });
    }
  }, [shopId]);

  // Payment Countdown Timer & Gateway / Stall Verification Polling Listener
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

    // 1. Poll UPIQRPay Gateway if dynamic merchant QR is active
    const pollInterval = setInterval(async () => {
      if (upiData?.paymentId && paymentStatus === 'WAITING') {
        try {
          const res = await paymentService.checkPaymentStatus(upiData.paymentId);
          // Only trigger automatic PAID if official gateway API returns PAID + UTR
          if (res?.data?.status === 'PAID' && res?.data?.utrNumber) {
            await handleGatewayConfirmedPayment(res.data.utrNumber);
            clearInterval(pollInterval);
          }
        } catch {}
      }

      // 2. Poll order status when waiting for Stall Owner to verify submitted UTR
      if (submittedOrderId && paymentStatus === 'VERIFYING_WITH_STALL') {
        try {
          const updatedOrder = await orderService.getOrder(submittedOrderId);
          if (updatedOrder) {
            if (updatedOrder.paymentStatus === 'PAID') {
              setPaymentStatus('PAID');
              clearInterval(pollInterval);
              setTimeout(() => {
                setIsPaymentModalOpen(false);
                navigate(`/order/${updatedOrder.id}`);
              }, 1400);
            } else if (
              updatedOrder.paymentStatus === 'FAILED' ||
              updatedOrder.orderStatus === 'CANCELLED'
            ) {
              setRejectionReason(
                updatedOrder.cancellationReason ||
                  'Stall owner rejected this UTR because payment was not received in their bank account.'
              );
              setPaymentStatus('REJECTED');
              clearInterval(pollInterval);
            }
          }
        } catch {}
      }
    }, 2500);

    // 3. Realtime subscription for instant Stall Owner approval/rejection
    let unsubscribeRealtime: (() => void) | undefined;
    if (submittedOrderId && paymentStatus === 'VERIFYING_WITH_STALL') {
      unsubscribeRealtime = paymentService.subscribeToPaymentUpdates(
        submittedOrderId,
        (newStatus, utr) => {
          if (newStatus === 'PAID') {
            if (utr) setPaymentUtr(utr);
            setPaymentStatus('PAID');
            setTimeout(() => {
              setIsPaymentModalOpen(false);
              navigate(`/order/${submittedOrderId}`);
            }, 1400);
          } else if (newStatus === 'FAILED' || newStatus === 'CANCELLED') {
            setRejectionReason(
              'Stall owner rejected this UTR because payment was not received in their UPI bank account.'
            );
            setPaymentStatus('REJECTED');
          }
        }
      );
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      clearInterval(pollInterval);
      if (unsubscribeRealtime) unsubscribeRealtime();
    };
  }, [isPaymentModalOpen, upiData?.paymentId, paymentStatus, submittedOrderId, navigate]);

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

  // Derived UPI Intent link & QR code image
  // shopUpiVpa is ONLY set when the shop owner has a registered UPI ID in the database
  const shopUpiVpa: string | null = shopDetails?.upiId?.trim() || null;
  const shopHasUpi = Boolean(shopUpiVpa);

  const directUpiUri = shopUpiVpa
    ? `upi://pay?pa=${encodeURIComponent(shopUpiVpa)}&pn=${encodeURIComponent(shopName || 'FoodFax Stall')}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Token Order ' + (pendingOrderId || 'FoodFax'))}`
    : '';
  const directQrImageUrl = shopUpiVpa
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(directUpiUri)}&margin=10`
    : '';

  const activeQrCodeUrl = upiData?.qrCode || directQrImageUrl;
  const activeUpiLink = upiData?.upiLink || directUpiUri;

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
   * Called when customer clicks "Generate Order Token" or "Pay with UPI"
   */
  const handlePlaceOrder = async () => {
    if (!validateOrderInputs()) return;

    setErrorMessage(null);
    setMerchantNotice(null);

    // If Cash at Counter: Immediately commit order and route to live tracker
    if (paymentMethod === 'CASH_AT_COUNTER') {
      setIsSubmitting(true);
      try {
        const orderItems = items.map(({ menuItem, quantity }) => ({
          id: `item-${Date.now()}-${menuItem.id}`,
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity,
          isVeg: menuItem.isVeg,
        }));

        const newOrder = await commitOrderAndClearCart({
          shopId: shopId!,
          shopName: shopName || 'Food Stall',
          shopImage: shopImage || undefined,
          shopLocation: shopDetails?.location?.address || shopDetails?.location?.landmark || 'Counter Stall',
          customerId: currentUser?.id,
          customerName: customerName.trim() || currentUser?.fullName || currentUser?.name || 'FoodFax Customer',
          customerPhone: customerPhone.trim() || currentUser?.phone || '',
          orderType,
          tableNumber: orderType === 'DINE_IN' ? tableNumber.trim() : undefined,
          paymentMethod: 'CASH_AT_COUNTER',
          items: orderItems,
          subtotal,
          total: grandTotal,
          estimatedPreparationMinutes: '5-10',
          instructions: instructions.trim() || undefined,
        });

        navigate(`/order/${newOrder.id}`);
      } catch (err: any) {
        console.error('Failed to place counter order:', err);
        setErrorMessage(err?.message || 'Could not place order. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // IF PAY ONLINE (UPI Dynamic QR):
    const orderRef = `ord-${Date.now().toString().slice(-6)}`;
    setPendingOrderId(orderRef);
    setSubmittedOrderId(null);
    setSubmittedTokenNumber(null);
    setRejectionReason(null);
    setManualUtrInput('');
    setUtrError(null);
    setPaymentStatus('WAITING');
    setPaymentUtr(null);
    setIsPaymentModalOpen(true);
    setIsSubmitting(true);

    try {
      // Call backend /api/payment/create-order to fetch dynamic UPIQRPay QR if configured
      const upiResult = await paymentService.createUpiOrder({
        orderId: orderRef,
        customerPhone: customerPhone.trim(),
        customerName: customerName.trim(),
        amount: grandTotal,
        shopId: shopId!,
      });

      if (upiResult.success && upiResult.data) {
        setUpiData(upiResult.data);
      } else {
        setUpiData(null);
        setMerchantNotice(
          `Direct UPI QR active for ${shopUpiVpa}. After paying, enter your 12-digit UPI UTR below for stall verification.`
        );
      }
    } catch {
      setUpiData(null);
      setMerchantNotice(
        `Direct UPI QR active for ${shopUpiVpa}. After paying, enter your 12-digit UPI UTR below for stall verification.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Called ONLY when official UPIQRPay gateway server confirms payment via bank webhook/status API
   */
  const handleGatewayConfirmedPayment = async (utrString: string) => {
    setIsVerifying(true);
    setPaymentStatus('PAID');
    setPaymentUtr(utrString);

    try {
      const orderItems = items.map(({ menuItem, quantity }) => ({
        id: `item-${Date.now()}-${menuItem.id}`,
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        isVeg: menuItem.isVeg,
      }));

      const newOrder = await commitOrderAndClearCart({
        id: pendingOrderId || undefined,
        shopId: shopId!,
        shopName: shopName || 'Food Stall',
        shopImage: shopImage || undefined,
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
        subtotal,
        total: grandTotal,
        estimatedPreparationMinutes: '5-10',
        instructions: instructions.trim() || undefined,
      });

      setTimeout(() => {
        setIsPaymentModalOpen(false);
        navigate(`/order/${newOrder.id}`);
      }, 1500);
    } catch (err: any) {
      console.error('Error committing gateway verified order:', err);
      setErrorMessage(err?.message || 'Error confirming order. Please contact counter staff.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Strictly validates customer's 12-digit UPI UTR / RRN, blocks fake/duplicate UTRs,
   * and submits order with paymentStatus='PENDING' so the Shop Owner MUST verify it before PAID.
   */
  const handleUtrSubmit = async () => {
    setUtrError(null);
    setIsVerifying(true);

    try {
      const verification = await paymentService.verifyAndValidateUtr({
        utrNumber: manualUtrInput,
        orderId: pendingOrderId,
        paymentId: upiData?.paymentId,
      });

      if (!verification.valid) {
        setUtrError(verification.error || 'Invalid 12-digit UPI UTR number.');
        setIsVerifying(false);
        return;
      }

      const cleanedUtr = verification.cleanedUtr;
      setPaymentUtr(cleanedUtr);

      // If official UPIQRPay gateway confirmed this UTR on the server, mark PAID immediately
      if (verification.verifiedByGateway) {
        await handleGatewayConfirmedPayment(cleanedUtr);
        return;
      }

      // Direct UPI Mode: NEVER mark as PAID automatically!
      // Save order as paymentStatus='PENDING' (Unverified UPI) and wait for Stall Owner confirmation.
      const orderItems = items.map(({ menuItem, quantity }) => ({
        id: `item-${Date.now()}-${menuItem.id}`,
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        isVeg: menuItem.isVeg,
      }));

      const newOrder = await commitOrderAndClearCart({
        id: pendingOrderId || undefined,
        shopId: shopId!,
        shopName: shopName || 'Food Stall',
        shopImage: shopImage || undefined,
        shopLocation: shopDetails?.location?.address || shopDetails?.location?.landmark || 'Counter Stall',
        customerId: currentUser?.id,
        customerName: customerName.trim() || currentUser?.fullName || currentUser?.name || 'FoodFax Customer',
        customerPhone: customerPhone.trim() || currentUser?.phone || '',
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber.trim() : undefined,
        paymentMethod: 'PAY_ONLINE',
        paymentStatus: 'PENDING',
        utrNumber: cleanedUtr,
        items: orderItems,
        subtotal,
        total: grandTotal,
        estimatedPreparationMinutes: '5-10',
        instructions: instructions.trim() || undefined,
      });

      setSubmittedOrderId(newOrder.id);
      setSubmittedTokenNumber(newOrder.tokenNumber);
      setPaymentStatus('VERIFYING_WITH_STALL');
    } catch (err: any) {
      console.error('Error submitting UTR for verification:', err);
      setUtrError(err?.message || 'Could not submit UTR for verification. Please try again.');
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
                  UPI: {shopUpiVpa}
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

            {/* 1. PAID / VERIFIED SCREEN (Only shown after Gateway Webhook OR Stall Owner Approval) */}
            {paymentStatus === 'PAID' ? (
              <div className="py-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-base font-black text-emerald-700">Payment Verified!</h4>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    {paymentUtr ? `Verified Bank UTR: ${paymentUtr}` : 'Payment confirmed by bank'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  Order token confirmed! Redirecting to live order tracker...
                </div>
              </div>
            ) : paymentStatus === 'VERIFYING_WITH_STALL' ? (
              /* 2. WAITING FOR STALL OWNER TO VERIFY UTR IN THEIR BANK / GPAY */
              <div className="py-5 text-center space-y-3.5 animate-in fade-in duration-200">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs relative">
                  <ShieldCheck className="w-8 h-8" />
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
                  </span>
                </div>

                <div>
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 mb-1">
                    Verification Pending • Token {submittedTokenNumber || ''}
                  </span>
                  <h4 className="text-base font-black text-slate-900">
                    Waiting for Stall Owner to Verify UTR
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    We sent your 12-digit UTR to <strong>{shopName}</strong>. The stall owner will verify{' '}
                    <strong>₹{grandTotal}</strong> in their UPI app ({shopUpiVpa}) before marking your order as paid.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Submitted 12-Digit UTR:</span>
                    <span className="font-mono font-black text-slate-900">{paymentUtr}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Match Last 4 Digits:</span>
                    <span className="font-mono font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {paymentUtr?.slice(-4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payment Status:</span>
                    <span className="font-bold text-amber-700">Awaiting Stall Confirmation...</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium text-left flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Anti-Fraud Active:</strong> Orders with fake or unreceived UTR numbers are automatically rejected by the stall terminal.
                  </span>
                </div>

                {submittedOrderId && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      navigate(`/order/${submittedOrderId}`);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Open Live Order Tracker (While Stall Verifies)
                  </button>
                )}
              </div>
            ) : paymentStatus === 'REJECTED' ? (
              /* 3. REJECTED SCREEN (Fake UTR / Money Not Received by Stall Owner) */
              <div className="py-5 text-center space-y-3.5 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="text-base font-black text-rose-700">Payment Verification Failed!</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {rejectionReason ||
                      `Stall owner rejected UTR ${paymentUtr} because ₹${grandTotal} was not received in their bank account.`}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  Order has been cancelled due to unverified UPI UTR.
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              /* 4. ACTIVE SCAN & PAY + STRICT 12-DIGIT UTR INPUT SCREEN */
              <div className="space-y-3.5">
                {/* Stall & Amount Header Card */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Total To Pay</span>
                    <span className="text-xl font-black text-slate-900">₹{grandTotal}</span>
                    {shopUpiVpa && (
                      <span className="block text-[10px] font-mono font-semibold text-emerald-700 mt-0.5">
                        To: {shopUpiVpa}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-slate-700 shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{formatSeconds(paymentCountdown)}</span>
                  </div>
                </div>

                {/* Dynamic QR Code Box */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center justify-center relative">
                  <img
                    src={activeQrCodeUrl}
                    alt="UPI Payment QR Code"
                    className="w-48 h-48 sm:w-52 sm:h-52 rounded-xl object-contain bg-white p-2.5 shadow-xs border border-slate-200"
                  />

                  {/* Scan Instruction */}
                  <div className="mt-2 text-center">
                    <p className="text-[11px] font-bold text-slate-700">Step 1: Scan &amp; Pay ₹{grandTotal} via any UPI App</p>
                    <p className="text-[10px] text-slate-400">Google Pay • PhonePe • Paytm • BHIM • CRED</p>
                  </div>
                </div>

                {/* Mobile Intent Direct Button */}
                <a
                  href={activeUpiLink}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open UPI App (GPay / PhonePe / Paytm)</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>

                {/* Payment Verification Mode Indicator */}
                {upiData?.paymentId ? (
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between text-xs text-blue-900">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                      </span>
                      <span className="text-[11px] font-semibold">Auto-detecting bank payment via gateway...</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Direct Stall UPI ({shopUpiVpa}):</strong> After paying in your UPI app, enter the{' '}
                      <strong>12-digit UPI UTR / Reference No.</strong> below so the stall owner can verify your payment.
                    </span>
                  </div>
                )}

                {/* Step 2: Strict 12-Digit NPCI UTR Reference Input */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-800">
                      Step 2: Enter 12-Digit UPI UTR / Ref No. *
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${
                      manualUtrInput.length === 12 ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      {manualUtrInput.length}/12 digits
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="12-digit UTR (e.g. 428190284721)"
                      value={manualUtrInput}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setManualUtrInput(digitsOnly);
                        if (utrError) setUtrError(null);
                      }}
                      className="flex-1 px-3 py-2.5 text-xs bg-white border border-slate-300 rounded-xl font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleUtrSubmit}
                      disabled={isVerifying || manualUtrInput.length !== 12}
                      className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      {isVerifying ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Verify UTR</span>
                    </button>
                  </div>
                  {utrError && (
                    <p className="text-[10px] font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      {utrError}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 leading-tight">
                    🔒 Strict 12-digit NPCI UTR check + Stall Owner bank verification. Fake or duplicate UTRs are rejected.
                  </p>
                </div>

                {/* Switch to Cash Option */}
                <button
                  type="button"
                  onClick={handleSwitchToCash}
                  className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
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
