import React from 'react';
import { useCart } from '../../context/CartContext';
import { AlertTriangle } from 'lucide-react';

export const CartConflictModal: React.FC = () => {
  const { conflictData, resolveConflict } = useCart();

  if (!conflictData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">
          Replace cart items?
        </h3>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          Your cart already contains items from <span className="font-semibold text-slate-900">{conflictData.existingShopName}</span>. FoodFlow stalls prepare orders separately at their own counters.
        </p>

        <div className="space-y-2.5">
          <button
            id="conflict-replace-btn"
            onClick={() => resolveConflict(true)}
            className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-98 text-white font-bold text-sm transition-all shadow-sm shadow-orange-600/20"
          >
            Start fresh with {conflictData.newShop.name}
          </button>
          <button
            id="conflict-cancel-btn"
            onClick={() => resolveConflict(false)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-semibold text-sm transition-all"
          >
            Keep current items
          </button>
        </div>
      </div>
    </div>
  );
};
