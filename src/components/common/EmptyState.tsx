import React from 'react';
import { ShoppingBag, Search, Store, AlertCircle, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  type: 'cart' | 'search' | 'shops' | 'orders' | 'saved' | 'error';
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  actionText,
  onAction,
}) => {
  const getDefaults = () => {
    switch (type) {
      case 'cart':
        return {
          icon: ShoppingBag,
          title: 'Your cart is empty',
          description: 'Explore local stalls, canteens, and tapris to add hot snacks and chai.',
          actionText: 'Browse Stalls',
        };
      case 'search':
        return {
          icon: Search,
          title: 'No shops or food items found',
          description: 'Try searching for something else like "Vada Pav", "Maggi", "Chai", or "Sandwich".',
          actionText: 'Clear Search',
        };
      case 'shops':
        return {
          icon: Store,
          title: 'No shops found nearby',
          description: 'Try choosing another category or change your ordering zone.',
          actionText: 'View All Stalls',
        };
      case 'orders':
        return {
          icon: ShoppingBag,
          title: 'No orders yet',
          description: 'Your counter orders and live tokens will appear here once placed.',
          actionText: 'Order Food Now',
        };
      case 'saved':
        return {
          icon: Store,
          title: 'No saved shops',
          description: 'Tap the heart icon on your favorite stalls for instant repeat ordering.',
          actionText: 'Discover Stalls',
        };
      case 'error':
      default:
        return {
          icon: AlertCircle,
          title: 'Something went wrong',
          description: 'Please check your connection and try again.',
          actionText: 'Try Again',
        };
    }
  };

  const defaults = getDefaults();
  const Icon = defaults.icon;
  const displayTitle = title || defaults.title;
  const displayDesc = description || defaults.description;
  const displayBtn = actionText || defaults.actionText;

  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center max-w-sm mx-auto animate-in fade-in duration-200">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-4 shadow-xs">
        <Icon className="w-8 h-8 stroke-[1.6]" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1 tracking-tight">
        {displayTitle}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
        {displayDesc}
      </p>

      {onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs sm:text-sm font-bold transition-all shadow-sm shadow-orange-600/20"
        >
          {type === 'error' && <RefreshCw className="w-3.5 h-3.5" />}
          <span>{displayBtn}</span>
        </button>
      )}
    </div>
  );
};
