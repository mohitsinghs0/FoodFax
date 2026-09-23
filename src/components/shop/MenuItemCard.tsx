import React from 'react';
import { MenuItem, Shop } from '../../types';
import { useCart } from '../../context/CartContext';
import { VegBadge } from '../common/VegBadge';
import { Plus, Minus, Flame, Clock } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
  shop: Shop;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, shop }) => {
  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(item.id);

  const handleAdd = () => {
    addItem(item, shop);
  };

  const handleIncrement = () => {
    updateQuantity(item.id, 1);
  };

  const handleDecrement = () => {
    updateQuantity(item.id, -1);
  };

  return (
    <div
      id={`menu-item-${item.id}`}
      className={`relative bg-white rounded-2xl border p-3.5 sm:p-4 transition-all flex gap-3.5 sm:gap-4 ${
        item.isAvailable
          ? 'border-slate-200/90 hover:border-orange-200 hover:shadow-xs'
          : 'border-slate-200/60 bg-slate-50/60 opacity-75'
      }`}
    >
      {/* Left Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Badges row: Veg, Bestseller */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <VegBadge isVeg={item.isVeg} size="sm" />
            {item.isBestseller && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight bg-amber-50 text-amber-700 border border-amber-200/60">
                <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                Popular
              </span>
            )}
            {item.preparationTimeMin && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500">
                <Clock className="w-2.5 h-2.5" />
                ~{item.preparationTimeMin}m
              </span>
            )}
          </div>

          {/* Item Name */}
          <h4
            className={`font-bold text-sm sm:text-base leading-snug ${
              item.isAvailable ? 'text-slate-900' : 'text-slate-500 line-through'
            }`}
          >
            {item.name}
          </h4>

          {/* Price */}
          <p className="font-extrabold text-sm sm:text-base text-slate-900 mt-1 tracking-tight">
            ₹{item.price}
          </p>

          {/* Description */}
          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Unavailable label if out of stock */}
        {!item.isAvailable && (
          <div className="mt-2">
            <span className="inline-block text-[11px] font-bold text-rose-600 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
              Currently Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Right Image + Action Stepper */}
      <div className="relative w-28 sm:w-32 flex flex-col items-center justify-between flex-shrink-0">
        {/* Item Image */}
        <div className="relative w-24 h-20 sm:w-28 sm:h-24 rounded-xl overflow-hidden bg-slate-100">
          <img
            src={item.image}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              item.isAvailable ? 'hover:scale-105' : 'grayscale opacity-70'
            }`}
            loading="lazy"
          />
          {!item.isAvailable && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-1 text-center">
              <span className="text-[10px] font-black uppercase text-white tracking-wider">
                Sold Out
              </span>
            </div>
          )}
        </div>

        {/* Add / Stepper Button */}
        <div className="w-full flex justify-center -mt-3.5 z-10">
          {!item.isAvailable ? (
            <button
              disabled
              className="px-4 py-1.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed border border-slate-300"
            >
              Unavailable
            </button>
          ) : quantity === 0 ? (
            <button
              id={`add-btn-${item.id}`}
              onClick={handleAdd}
              disabled={!shop.isOpen}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                shop.isOpen
                  ? 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50 hover:border-orange-300 shadow-orange-500/10'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add</span>
            </button>
          ) : (
            <div className="flex items-center justify-between bg-orange-600 text-white rounded-xl shadow-md shadow-orange-600/25 border border-orange-500 px-1 py-0.5 w-24">
              <button
                id={`decrement-${item.id}`}
                onClick={handleDecrement}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-700 active:scale-90 transition-transform"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
              <span className="font-extrabold text-xs tracking-tight">
                {quantity}
              </span>
              <button
                id={`increment-${item.id}`}
                onClick={handleIncrement}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-700 active:scale-90 transition-transform"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
