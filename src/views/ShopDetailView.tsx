import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { shopService } from '../services/shopService';
import { menuService } from '../services/menuService';
import { Shop, MenuItem, ShopCategory } from '../types';
import { MenuItemCard } from '../components/shop/MenuItemCard';
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
  Check
} from 'lucide-react';
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

  useEffect(() => {
    const loadShopData = async () => {
      setLoading(true);
      try {
        const foundShop = await shopService.getShop(shopId);
        if (foundShop) {
          setShop(foundShop);
          const [items, cats] = await Promise.all([
            menuService.getMenuItems(foundShop.id),
            shopService.getCategories(),
          ]);
          setMenuItems(items);
          setCategories(cats);
          setIsSaved(shopService.isShopSaved(foundShop.id));
        }
      } catch (err) {
        console.error('Failed to load shop details:', err);
      } finally {
        setLoading(false);
      }
    };
    loadShopData();
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
      <div className="py-20 px-4 max-w-md mx-auto text-center bg-white rounded-3xl border border-slate-200 mt-6 p-8">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Stall Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">
          The stall you are looking for might have closed or moved.
        </p>
        <button
          onClick={() => navigate('/shops')}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          Browse All Stalls
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Top Banner & Header */}
      <div className="relative h-56 sm:h-72 w-full bg-slate-900 overflow-hidden">
        <img
          src={shop.bannerImage || shop.image}
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
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1 font-bold text-slate-800">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{shop.rating.toFixed(1)}</span>
              <span className="text-slate-400 font-normal">({shop.totalReviews}+)</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Prep: {shop.preparationTimeMinutes} mins</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="truncate max-w-xs">{shop.location.address}</span>
            </div>
          </div>

          {shop.contactPhone && (
            <a
              href={`tel:${shop.contactPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-orange-500" />
              <span>{shop.contactPhone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items in this menu..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Veg Toggle */}
          <button
            onClick={() => setOnlyVeg(!onlyVeg)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 self-start sm:self-auto ${
              onlyVeg
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Pure Veg Only
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
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
    </div>
  );
};
