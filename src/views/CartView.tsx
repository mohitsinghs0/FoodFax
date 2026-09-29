import React from 'react';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { VegBadge } from '../components/common/VegBadge';
import { 
  ShoppingBag, 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Minus, 
  Store, 
  ArrowRight, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';

export const CartView: React.FC = () => {
  const { navigate, goBack } = useRouter();
  const { items, shopId, shopName, shopImage, subtotal, updateQuantity, removeItem, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="py-20 px-4 max-w-md mx-auto text-center">
        <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-orange-100 shadow-xs">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-1">Your cart is empty</h2>
        <p className="text-xs text-slate-500 mb-6 max-w-xs mx-auto">
          Explore delicious local street food counters, tapris, and college canteens nearby.
        </p>
        <button
          onClick={() => navigate('/shops')}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all"
        >
          Explore Stalls
        </button>
      </div>
    );
  }

  const convenienceFee = 0;
  const grandTotal = subtotal + convenienceFee;

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 max-w-3xl mx-auto space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-orange-500" />
              Your Cart
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Ordering from <strong className="text-slate-800">{shopName}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={clearCart}
          className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Cart
        </button>
      </div>

      {/* Cart Items List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {items.map(({ menuItem, quantity }) => (
          <div key={menuItem.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <VegBadge isVeg={menuItem.isVeg} size="sm" />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-slate-900 truncate">{menuItem.name}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  ₹{menuItem.price} each
                </p>
              </div>
            </div>

            {/* Quantity Controls & Line Total */}
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => updateQuantity(menuItem.id, -1)}
                  className="w-7 h-7 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-700 hover:text-orange-600 font-bold transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-7 text-center font-bold text-xs text-slate-900">
                  {quantity}
                </span>
                <button
                  onClick={() => updateQuantity(menuItem.id, 1)}
                  className="w-7 h-7 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-700 hover:text-orange-600 font-bold transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="font-black text-sm text-slate-900 w-16 text-right">
                ₹{menuItem.price * quantity}
              </span>
            </div>
          </div>
        ))}

        {/* Add more items link */}
        <div className="p-3.5 bg-slate-50/70 text-center">
          <button
            onClick={() => navigate(shopId ? `/shop/${shopId}` : '/shops')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center justify-center gap-1 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Add more items from {shopName || 'this stall'}
          </button>
        </div>
      </div>

      {/* Bill Details */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Bill Breakdown</h3>
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Item Subtotal</span>
            <span className="font-semibold text-slate-900">₹{subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Convenience & Platform Fee</span>
            <span className="font-semibold text-emerald-600">FREE</span>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-black text-slate-900">
          <span>To Pay</span>
          <span className="text-base text-orange-600">₹{grandTotal}</span>
        </div>
      </div>

      {/* Checkout CTA */}
      <div className="pt-2">
        <button
          onClick={() => navigate('/checkout')}
          className="w-full py-3.5 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm shadow-md shadow-orange-500/20 flex items-center justify-between transition-all"
        >
          <div className="text-left">
            <span className="block text-[11px] font-medium opacity-90 leading-tight">Total Payable</span>
            <span className="text-base leading-none">₹{grandTotal}</span>
          </div>
          <div className="flex items-center gap-1 font-bold">
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
};
