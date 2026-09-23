import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { OrderType, PaymentMethod } from '../types';
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
  const { currentUser, isAuthenticated } = useAuth();
  const { items, shopId, shopName, shopImage, subtotal, clearCart, commitOrderAndClearCart } = useCart();

  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_AT_COUNTER');
  const [instructions, setInstructions] = useState('');
  const [customerName, setCustomerName] = useState(currentUser?.fullName || currentUser?.name || 'Guest Customer');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        shopLocation: 'Local Counter Stall',
        customerId: currentUser?.id || `cust-${Date.now().toString().slice(-6)}`,
        customerName: customerName.trim() || 'Guest Customer',
        customerPhone: customerPhone.trim(),
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
    <div className="py-4 sm:py-6 px-4 sm:px-6 max-w-3xl mx-auto space-y-5 pb-28">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900">Checkout & Token Confirmation</h1>
          <p className="text-xs text-slate-500 mt-0.5">
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
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <h2 className="font-bold text-sm text-slate-900">1. Select Order Type</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOrderType('TAKEAWAY')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all ${
              orderType === 'TAKEAWAY'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className={`w-4 h-4 ${orderType === 'TAKEAWAY' ? 'text-orange-600' : 'text-slate-500'}`} />
              <span className="font-bold text-sm">Takeaway / Parcel</span>
            </div>
            <p className="text-[11px] text-slate-500">Pick up at stall counter when ready</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderType('DINE_IN')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all ${
              orderType === 'DINE_IN'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Utensils className={`w-4 h-4 ${orderType === 'DINE_IN' ? 'text-orange-600' : 'text-slate-500'}`} />
              <span className="font-bold text-sm">Dine-in Table</span>
            </div>
            <p className="text-[11px] text-slate-500">Served right to your table or counter bar</p>
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
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <h2 className="font-bold text-sm text-slate-900">3. Payment Preference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod('CASH_AT_COUNTER')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all ${
              paymentMethod === 'CASH_AT_COUNTER'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-sm">Pay Cash at Counter</span>
            </div>
            <p className="text-[11px] text-slate-500">Pay when your token is called</p>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('PAY_ONLINE')}
            className={`p-3.5 rounded-xl border-2 text-left transition-all ${
              paymentMethod === 'PAY_ONLINE'
                ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <QrCode className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-sm">UPI / Online Pay</span>
            </div>
            <p className="text-[11px] text-slate-500">Scan Stall QR or Google Pay / PhonePe</p>
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
