import React from 'react';
import { Shop } from '../../types';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { shopService } from '../../services/shopService';
import { Clock, MapPin, Star, Heart, Store } from 'lucide-react';

interface ShopCardProps {
  shop: Shop;
  isSaved?: boolean;
  onToggleSaved?: (shopId: string) => void;
  layout?: 'card' | 'compact' | 'horizontal';
}

export const ShopCard: React.FC<ShopCardProps> = ({
  shop,
  isSaved = false,
  onToggleSaved,
  layout = 'card',
}) => {
  const { route, navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  const handleCardClick = () => {
    navigate(`/shop/${shop.slug}`);
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(route.path || '/')}`);
      return;
    }
    if (onToggleSaved) {
      onToggleSaved(shop.id);
    } else {
      shopService.toggleSaveShop(shop.id);
    }
  };

  const formatDistance = (dist?: number | string) => {
    if (dist === undefined || dist === null) return 'Nearby';
    const num = typeof dist === 'number' ? dist : parseFloat(dist);
    if (isNaN(num)) return String(dist);
    if (num < 1) return `${Math.round(num * 1000)} m`;
    return `${num.toFixed(1)} km`;
  };

  if (layout === 'horizontal') {
    return (
      <div
        onClick={handleCardClick}
        className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-orange-300 hover:shadow-md transition-all p-3.5 flex gap-3.5 cursor-pointer"
      >
        {/* Stall Thumbnail */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
          <img
            src={shop.image}
            alt={shop.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {!shop.isOpen && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-1 text-center">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                Closed
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-1.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200/50">
                  {shop.stallType}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-orange-600 transition-colors truncate mt-1">
                  {shop.name}
                </h3>
              </div>
              <button
                onClick={handleHeartClick}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                aria-label={isSaved ? 'Remove from saved' : 'Save stall'}
              >
                <Heart
                  className={`w-4 h-4 ${
                    isSaved ? 'fill-rose-500 text-rose-500' : 'stroke-[1.8]'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
              {shop.tagline}
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 mt-2">
            <div className="flex items-center gap-1 font-semibold text-slate-900">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{shop.rating}</span>
              <span className="text-slate-400 text-[11px]">({shop.totalReviews})</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <div className="flex items-center gap-1 font-medium text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{shop.preparationTimeMinutes} min</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <div className="flex items-center gap-1 font-medium text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatDistance(shop.location?.distanceKm)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-orange-300 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full"
    >
      {/* Stall Hero Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <img
          src={shop.image}
          alt={shop.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Stall Type Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-900/80 text-white backdrop-blur-xs shadow-xs">
            {shop.stallType}
          </span>
        </div>

        {/* Open / Closed status pill */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-md shadow-xs ${
              shop.isOpen
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                shop.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            {shop.isOpen ? 'Open' : 'Closed'}
          </span>

          <button
            onClick={handleHeartClick}
            className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-600 hover:text-rose-500 hover:bg-white shadow-xs transition-colors"
            aria-label={isSaved ? 'Remove from saved' : 'Save stall'}
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                isSaved ? 'fill-rose-500 text-rose-500' : 'stroke-[2]'
              }`}
            />
          </button>
        </div>

        {/* Fast counter badge */}
        <div className="absolute bottom-2.5 left-2.5">
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-xs px-2 py-1 rounded-lg text-slate-800 text-[11px] font-bold shadow-xs">
            <Clock className="w-3 h-3 text-orange-600" />
            <span>{shop.preparationTimeMinutes} min prep</span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1">
              {shop.name}
            </h3>
            <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded text-amber-900 text-xs font-bold flex-shrink-0 border border-amber-200/50">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{shop.rating}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 line-clamp-1 mt-1">
            {shop.tagline}
          </p>

          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-2">
            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="truncate">{shop.location.landmark}</span>
            <span>•</span>
            <span className="font-semibold text-slate-600">{formatDistance(shop.location?.distanceKm)}</span>
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500">
            {shop.isPureVeg ? '🟢 Pure Veg Stall' : 'Veg & Snacks'}
          </span>
          <span className="text-xs font-bold text-orange-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
            View Menu →
          </span>
        </div>
      </div>
    </div>
  );
};
