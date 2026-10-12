import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { shopService } from '../services/shopService';
import { menuService } from '../services/menuService';
import { Shop, MenuItem, ShopCategory } from '../types';
import { MenuItemCard } from '../components/shop/MenuItemCard';
import { VoiceOrderModal } from '../components/shop/VoiceOrderModal';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Star, 
  Phone, 
  Heart, 
  Share2, 
  Search, 
  Utensils, 
  AlertCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Check,
  Mic,
  Bike,
  AlertTriangle
} from 'lucide-react';
import { calculateDistanceKm, DEFAULT_CUSTOMER_LOCATION } from '../services/geoService';
import { VegBadge } from '../components/common/VegBadge';

interface ShopDetailViewProps {
  shopId: string;
}

export const ShopDetailView: React.FC<ShopDetailViewProps> = ({ shopId }) => {
  const { navigate, goBack } = useRouter();
  const { isAuthenticated } = useAuth();
  const { items: cartItems } = useCart();

  const [shop, setShop] = useState<Shop | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyVeg, setOnlyVeg] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Safety fallback: Never keep user stuck on loading spinner for more than 8 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 8000);

    const loadShopData = async () => {
      // 1. Instant optimistic check: check local stored shops for instant rendering (0ms)
      try {
        const localShops = shopService.getStoredShops();
        const cleanTargetId = decodeURIComponent(String(shopId || '')).toLowerCase().trim();
        const cleanAlpha = cleanTargetId.replace(/[^a-z0-9]/g, '');
        const instantFound = localShops.find(
          (s) =>
            (s.id && s.id.toLowerCase() === cleanTargetId) ||
            (s.slug && s.slug.toLowerCase() === cleanTargetId) ||
            (s.name && s.name.toLowerCase() === cleanTargetId) ||
            (cleanAlpha && s.id && s.id.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha) ||
            (cleanAlpha && s.slug && s.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha) ||
            (cleanAlpha && s.name && s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha)
        );
        if (instantFound && isMounted) {
          setShop(instantFound);
          setLoading(false);
          const cachedMenu = menuService.getStoredItems().filter(
            (i) =>
              (i.shopId && i.shopId.toLowerCase() === instantFound.id.toLowerCase()) ||
              (instantFound.slug && i.shopId.toLowerCase() === instantFound.slug.toLowerCase())
          );
          if (cachedMenu.length > 0) {
            setMenuItems(cachedMenu);
          }
          setCategories(menuService.getStoredCategories());
          setIsSaved(shopService.isShopSaved(instantFound.id));
        }
      } catch {}

      // 2. Fetch fresh remote data with timeout
      try {
        let foundShop = await shopService.getShopById(shopId);
        if (!foundShop) {
          const nearby = await shopService.getNearbyShops();
          if (nearby.length === 1) {
            foundShop = nearby[0];
          }
        }
        if (foundShop && isMounted) {
          setShop(foundShop);
          try {
            const [items, cats] = await Promise.all([
              menuService.getMenuItems(foundShop.id, foundShop.slug),
              shopService.getCategories(),
            ]);
            if (isMounted) {
              setMenuItems(items && items.length > 0 ? items : []);
              setCategories(cats || []);
              setIsSaved(shopService.isShopSaved(foundShop.id));
            }
          } catch {
            if (isMounted) {
              const fallbackItems = await menuService.getMenuItems(foundShop.id, foundShop.slug);
              setMenuItems(fallbackItems || []);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load shop details:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadShopData();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [shopId]);

  const handleToggleSaved = () => {
    if (!shop) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/shop/${shop.slug}`)}`);
      return;
    }
    const saved = shopService.toggleSaveShop(shop.id);
    setIsSaved(saved);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Grouped and filtered items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCategory =
        selectedCategory === 'all' || item.categoryId === selectedCategory;
      const matchSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchVeg = !onlyVeg || item.isVeg;

      return matchCategory && matchSearch && matchVeg;
    });
  }, [menuItems, selectedCategory, searchQuery, onlyVeg]);

  // Extract relevant categories for this shop
  const shopCategoryIds = new Set(menuItems.map((i) => i.categoryId));
  const availableCategories = categories.filter((c) => shopCategoryIds.has(c.id));

  // Distance from active customer location
  const distanceKm = useMemo(() => {
    if (!shop) return undefined;
    let customerLoc = DEFAULT_CUSTOMER_LOCATION;
    try {
      const saved = localStorage.getItem('foodfax_active_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) {
          customerLoc = parsed;
        }
      }
    } catch {}

    const sLat = shop.latitude || shop.location?.latitude;
    const sLng = shop.longitude || shop.location?.longitude;
    if (customerLoc.latitude && customerLoc.longitude && sLat && sLng) {
      return calculateDistanceKm(customerLoc.latitude, customerLoc.longitude, sLat, sLng);
    }
    return shop.location?.distanceKm;
  }, [shop]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Opening stall menu...</p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="py-16 px-4 max-w-md mx-auto text-center bg-white rounded-3xl border border-slate-200 mt-6 p-8 shadow-xs">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Stall Not Available</h2>
        <p className="text-xs text-slate-500 mb-6">
          The stall you are looking for might be temporarily unavailable or closed.
        </p>
        <button
          onClick={() => navigate('/')}
          className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          Explore Nearby Food Spots
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Top Banner & Header */}
      <div className="relative h-56 sm:h-72 w-full bg-slate-900 overflow-hidden">
        <img
          src={
            (shop.bannerImage && shop.bannerImage.trim() !== '')
              ? shop.bannerImage.trim()
              : (shop.image && shop.image.trim() !== '')
              ? shop.image.trim()
              : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80'
          }
          alt={shop.name}
          className="w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />

        {/* Floating Top Controls */}
        <div className="absolute top-4 inset-x-4 sm:inset-x-8 max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={goBack}
            className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors relative"
              aria-label="Share"
            >
              {copiedLink ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
            </button>
            <button
              onClick={handleToggleSaved}
              className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
              aria-label="Save"
            >
              <Heart
                className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-white'}`}
              />
            </button>
          </div>
        </div>

        {/* Stall Header Info Overlay */}
        <div className="absolute bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-8 max-w-7xl mx-auto text-white">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-orange-500 text-white uppercase tracking-wider shadow-xs">
              {shop.stallType}
            </span>
            {shop.isPureVeg && (
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white" /> Pure Veg
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider ${
                shop.isOpen ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {shop.isOpen ? 'Open Now' : 'Closed'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{shop.name}</h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-2xl line-clamp-1">
            {shop.tagline || shop.description}
          </p>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-8 py-3 sm:py-3.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1 font-bold text-slate-800">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{shop.rating.toFixed(1)}</span>
              <span className="text-slate-400 font-normal">({shop.totalReviews}+)</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Prep: {shop.preparationTimeMinutes} mins</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate max-w-[150px] xs:max-w-xs">{shop.location?.address || shop.address || 'Counter Stall'}</span>
            </div>

            {distanceKm !== undefined && (
              <>
                <span className="text-slate-300">•</span>
                <div
                  className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-md border text-[11px] ${
                    distanceKm <= 2.0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : distanceKm <= 4.0
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {distanceKm <= 2.0 ? (
                    <>
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      <span>~{distanceKm} km (Walking Zone)</span>
                    </>
                  ) : distanceKm <= 4.0 ? (
                    <>
                      <Bike className="w-3 h-3 text-amber-600" />
                      <span>~{distanceKm} km (Bike / Car Zone)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>~{distanceKm} km (Exceeds 4 km Limit)</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {shop.contactPhone && (
            <a
              href={`tel:${shop.contactPhone}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition-colors w-full sm:w-auto"
            >
              <Phone className="w-3.5 h-3.5 text-orange-500" />
              <span>{shop.contactPhone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Far Distance Caution Banner (if > 2 km) */}
      {distanceKm !== undefined && distanceKm > 2.0 && (
        <div
          className={`border-b px-3 sm:px-8 py-2.5 text-xs ${
            distanceKm <= 4.0
              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
              : 'bg-rose-50/90 border-rose-200 text-rose-900'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            {distanceKm <= 4.0 ? (
              <Bike className="w-4 h-4 text-amber-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <p className="leading-snug">
              {distanceKm <= 4.0 ? (
                <span>
                  <strong>Pickup Notice ({distanceKm} km away):</strong> This counter is outside your 2 km local walking zone. Recommended for pickup via <strong>Bike or Car</strong>.
                </span>
              ) : (
                <span>
                  <strong>Distance Limit ({distanceKm} km away):</strong> This counter exceeds the standard 4 km pickup limit. Please choose a closer counter for quick pickup.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 overflow-x-hidden min-w-0">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items in this menu..."
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Hands-Free Voice Ordering Button */}
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black shadow-sm shadow-orange-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              title="Order items hands-free using your voice"
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Voice Order</span>
              <span className="text-[9px] uppercase font-bold bg-white/25 px-1 py-0.5 rounded-full">
                Hands-Free
              </span>
            </button>

            {/* Veg Toggle */}
            <button
              onClick={() => setOnlyVeg(!onlyVeg)}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                onlyVeg
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0" />
              <span>Pure Veg Only</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full min-w-0 py-0.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Items ({menuItems.length})
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-500" />
              Menu Items ({filteredItems.length})
            </h2>
          </div>

          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredItems.map((item) => (
                <MenuItemCard key={item.id} item={item} shop={shop} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center bg-white rounded-2xl border border-slate-200/80 p-8">
              <p className="text-xs font-semibold text-slate-500">
                No items found matching your filters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Hands-Free Voice Order Button (Positioned safely above BottomNav & FloatingCart) */}
      <button
        onClick={() => setIsVoiceModalOpen(true)}
        className={`fixed right-3 sm:right-8 z-30 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white font-black text-xs shadow-xl shadow-orange-600/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 sm:ring-3 ring-white/60 backdrop-blur-xs ${
          cartItems.length > 0
            ? 'bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] md:bottom-24'
            : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-8'
        }`}
        aria-label="Order with voice hands-free"
        title="Tap to order hands-free with voice"
      >
        <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white" />
        </span>
        <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        <span className="tracking-tight text-xs">Voice Order</span>
      </button>

      {/* Hands-Free Voice-to-Text Ordering Modal */}
      {isVoiceModalOpen && (
        <VoiceOrderModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          shop={shop}
          menuItems={menuItems}
        />
      )}
    </div>
  );
};
