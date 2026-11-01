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
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-0 right-0 z-30 px-3.5 sm:px-4 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl text-white rounded-2xl p-2.5 sm:p-3 shadow-float border border-white/10 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center flex-shrink-0 shadow-xs">
              <ShoppingBag className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] sm:text-xs font-medium text-slate-300 truncate max-w-[110px] xs:max-w-[140px] sm:max-w-[180px]">
                  {shopName || 'Your Stall'}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                <span className="text-[11px] sm:text-xs text-orange-400 font-semibold whitespace-nowrap flex-shrink-0">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-none mt-1">
                ₹{subtotal}
              </p>
            </div>
          </div>

          <button
            id="floating-view-cart-btn"
            onClick={() => navigate('/cart')}
            className="flex items-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-xs font-bold transition-all flex-shrink-0 shadow-sm shadow-orange-500/30"
          >
            <span>View Cart</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
