import React from 'react';
import { useCart } from '../../context/CartContext';
import { useRouter } from '../../context/RouterContext';
import { ShoppingBag, ArrowRight } from 'lucide-react';

export const FloatingCartBar: React.FC = () => {
  const { totalItems, subtotal, shopName } = useCart();
  const { route, navigate } = useRouter();

  // Hide floating cart on cart, checkout, or order-tracking pages to avoid clutter
  if (
    totalItems === 0 ||
    route.name === 'cart' ||
    route.name === 'checkout' ||
    route.name === 'order-tracker'
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-30 px-4 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-3.5 shadow-xl shadow-slate-900/25 border border-slate-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center flex-shrink-0 text-white shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300 truncate max-w-[130px] sm:max-w-[180px]">
                  {shopName || 'Your Stall'}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-500" />
                <span className="text-xs text-orange-400 font-medium">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-base font-bold text-white tracking-tight leading-none mt-0.5">
                ₹{subtotal}
              </p>
            </div>
          </div>

          <button
            id="floating-view-cart-btn"
            onClick={() => navigate('/cart')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-95 text-white text-xs font-bold transition-all flex-shrink-0 shadow-sm shadow-orange-600/30"
          >
            <span>View Cart</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
