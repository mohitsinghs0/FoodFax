import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { shopService } from '../services/shopService';
import { OrderType, PaymentMethod, Shop } from '../types';
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
  QrCode
} from 'lucide-react';

export const CheckoutView: React.FC = () => {
  const { navigate, goBack } = useRouter();
  const { currentUser, isAuthenticated, isLoading } = useAuth();
  const { items, shopId, shopName, shopImage, subtotal, clearCart, commitOrderAndClearCart } = useCart();

  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_AT_COUNTER');
  const [instructions, setInstructions] = useState('');
  const [customerName, setCustomerName] = useState(currentUser?.fullName || currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shopDetails, setShopDetails] = useState<Shop | null>(null);

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
        if (s) setShopDetails(s);
      });
    }
  }, [shopId]);

  if (isLoading && !currentUser) {
    return (
      <div className="py-20 px-4 max-w-md mx-auto text-center">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-500">Checking your account...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-20 px-4 max-w-md mx-auto text-center">
        <h2 className="text-xl font-black text-slate-900 mb-2">No items in cart</h2>
        <p className="text-xs text-slate-500 mb-6">Add items from a food stall first.</p>
        <button
          onClick={() => navigate('/shops')}
          className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-orange-600"
        >
          Browse Stalls
        </button>
      </div>
    );
  }

  const grandTotal = subtotal;

  const handlePlaceOrder = async () => {
    if (!isAuthenticated || !currentUser) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('foodfax_post_login_redirect', '/checkout');
      }
      navigate('/login?redirect=/checkout');
      return;
    }

    if (!shopId) return;
    if (orderType === 'DINE_IN' && !tableNumber.trim()) {
      setErrorMessage('Please enter your table number for Dine-In orders.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Please enter your contact phone number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

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
        shopId,
        shopName: shopName || 'Food Stall',
        shopImage: shopImage || undefined,
        shopLocation: shopDetails?.location?.address || shopDetails?.location?.landmark || 'Counter Stall',
        customerId: currentUser.id,
        customerName: customerName.trim() || currentUser.fullName || currentUser.name || 'FoodFax Customer',
        customerPhone: customerPhone.trim() || currentUser.phone || '',
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber.trim() : undefined,
        paymentMethod,
        items: orderItems,
        subtotal,
        total: grandTotal,
        estimatedPreparationMinutes: '5-10',
        instructions: instructions.trim() || undefined,
      });

      // Navigate to Live Order Tracker
      navigate(`/order/${newOrder.id}`);
    } catch (err: any) {
      console.error('Failed to place order:', err);
      setErrorMessage(err?.message || 'Could not place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 max-w-3xl mx-auto space-y-4 sm:space-y-5 pb-28 overflow-x-hidden min-w-0">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex-shrink-0"
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

      {/* Order Type Selection */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3">
        <h2 className="font-bold text-sm text-slate-900">1. Select Order Type</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setOrderType('TAKEAWAY')}
            className={`p-3 sm:p-3.5 rounded-xl border-2 text-left transition-all min-w-0 ${
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
            className={`p-3 sm:p-3.5 rounded-xl border-2 text-left transition-all min-w-0 ${
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

      {/* Customer Info */}
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

      {/* Payment Method */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3">
        <h2 className="font-bold text-sm text-slate-900">3. Payment Preference</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('CASH_AT_COUNTER')}
            className={`p-3 sm:p-3.5 rounded-xl border-2 text-left transition-all min-w-0 ${
              paymentMethod === 'CASH_AT_COUNTER'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 min-w-0">
              <Banknote className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-bold text-xs sm:text-sm truncate">Cash at Counter</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">Pay when token called</p>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('PAY_ONLINE')}
            className={`p-3 sm:p-3.5 rounded-xl border-2 text-left transition-all min-w-0 ${
              paymentMethod === 'PAY_ONLINE'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 min-w-0">
              <QrCode className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="font-bold text-xs sm:text-sm truncate">UPI / Online Pay</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">GPay / PhonePe / QR</p>
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

      <button
        onClick={handlePlaceOrder}
        disabled={isSubmitting}
        className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-base shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Generating Order Token...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Generate Order Token (₹{grandTotal})</span>
          </>
        )}
      </button>
    </div>
  );
};
