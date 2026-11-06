import React from 'react';
import { Shop } from '../../types';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { shopService } from '../../services/shopService';
import { Clock, MapPin, Star, Heart, Store } from 'lucide-react';

const DEFAULT_SHOP_IMG = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';

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
    navigate(`/shop/${shop.slug || shop.id}`);
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
        className="group relative bg-white rounded-2xl border border-slate-100 hover:border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200 p-3 sm:p-3.5 flex gap-3 sm:gap-3.5 cursor-pointer overflow-hidden min-w-0"
      >
        {/* Stall Thumbnail */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
          <img
            src={shop.image?.trim() ? shop.image : DEFAULT_SHOP_IMG}
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
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/60">
                  {shop.stallType}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-orange-600 transition-colors truncate mt-1">
                  {shop.name}
                </h3>
              </div>
              <button
                onClick={handleHeartClick}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
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

          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-600 mt-2 min-w-0">
            <div className="flex items-center gap-1 font-bold text-white bg-emerald-700 px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs">
              <Star className="w-3 h-3 fill-white text-white" />
              <span>{shop.rating}</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
            <div className="flex items-center gap-1 font-medium text-slate-600 shrink-0">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{shop.preparationTimeMinutes}m</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
            <div className="flex items-center gap-1 font-medium text-slate-600 min-w-0 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{formatDistance(shop.location?.distanceKm)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-white rounded-2xl border border-slate-100 hover:border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col h-full min-w-0"
    >
      {/* Stall Hero Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <img
          src={shop.image?.trim() ? shop.image : DEFAULT_SHOP_IMG}
          alt={shop.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Subtle gradient vignette at bottom of image for badge contrast */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />

        {/* Stall Type Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-black/60 text-white backdrop-blur-md shadow-xs">
            {shop.stallType}
          </span>
        </div>

        {/* Open / Closed status pill & Heart Button */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {!shop.isOpen && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/30 backdrop-blur-md shadow-xs">
              Closed
            </span>
          )}

          <button
            onClick={handleHeartClick}
            className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-600 hover:text-rose-500 hover:bg-white shadow-xs transition-colors"
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
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-slate-800 text-[11px] font-semibold shadow-xs border border-white/60">
            <Clock className="w-3 h-3 text-orange-600" />
            <span>{shop.preparationTimeMinutes} min prep</span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1 flex-1 min-w-0">
              {shop.name}
            </h3>
            <div className="flex items-center gap-1 bg-emerald-700 text-white px-2 py-0.5 rounded-md text-xs font-bold shrink-0 shadow-2xs">
              <Star className="w-3 h-3 fill-white text-white" />
              <span>{shop.rating}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 line-clamp-1 mt-1 font-normal">
            {shop.tagline}
          </p>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-2 min-w-0">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate flex-1 min-w-0">{shop.location?.landmark || shop.address || shop.area || shop.stallType}</span>
            <span className="shrink-0">•</span>
            <span className="font-semibold text-slate-700 shrink-0">{formatDistance(shop.location?.distanceKm)}</span>
          </div>
        </div>

        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 truncate mr-2 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${shop.isPureVeg ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {shop.isPureVeg ? 'Pure Veg Stall' : 'Veg & Snacks'}
          </span>
          <span className="text-xs font-semibold text-orange-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0">
            View Menu →
          </span>
        </div>
      </div>
    </div>
  );
};
