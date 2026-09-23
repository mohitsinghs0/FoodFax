import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from '../context/RouterContext';
import { shopService } from '../services/shopService';
import { menuService } from '../services/menuService';
import { Shop, MenuItem, ShopCategory } from '../types';
import { ShopCard } from '../components/shop/ShopCard';
import { MenuItemCard } from '../components/shop/MenuItemCard';
import { Search, X, UtensilsCrossed, Store, ArrowLeft, Filter, Sparkles } from 'lucide-react';

export const SearchView: React.FC = () => {
  const { route, navigate, goBack } = useRouter();
  const initialQuery = route.params?.q || route.searchQuery || '';
  const [query, setQuery] = useState(initialQuery);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [menuItems, setMenuItems] = useState<{ item: MenuItem; shop: Shop }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyVeg, setOnlyVeg] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'dishes' | 'shops'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [cats, allShops] = await Promise.all([
          shopService.getCategories(),
          shopService.getNearbyShops(),
        ]);
        setCategories(cats);
        setShops(allShops);

        // Fetch menu items across stalls for dishes search
        const dishPromises = allShops.slice(0, 8).map(async (shop) => {
          const items = await menuService.getMenuItems(shop.id);
          return items.map((item) => ({ item, shop }));
        });
        const nestedDishes = await Promise.all(dishPromises);
        setMenuItems(nestedDishes.flat());
      } catch (err) {
        console.error('Failed to load search data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const normalizedQuery = query.toLowerCase().trim();

  // Filtered Shops
  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const matchQuery =
        !normalizedQuery ||
        s.name.toLowerCase().includes(normalizedQuery) ||
        s.stallType.toLowerCase().includes(normalizedQuery) ||
        s.tagline.toLowerCase().includes(normalizedQuery) ||
        s.location.address.toLowerCase().includes(normalizedQuery);

      const matchCategory =
        selectedCategory === 'all' ||
        s.categories.includes(selectedCategory);

      const matchVeg = !onlyVeg || s.isPureVeg;

      return matchQuery && matchCategory && matchVeg;
    });
  }, [shops, normalizedQuery, selectedCategory, onlyVeg]);

  // Filtered Dishes
  const filteredDishes = useMemo(() => {
    return menuItems.filter(({ item, shop }) => {
      const matchQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        shop.name.toLowerCase().includes(normalizedQuery);

      const matchCategory =
        selectedCategory === 'all' || item.categoryId === selectedCategory;

      const matchVeg = !onlyVeg || item.isVeg;

      return matchQuery && matchCategory && matchVeg;
    });
  }, [menuItems, normalizedQuery, selectedCategory, onlyVeg]);

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 max-w-5xl mx-auto space-y-5">
      {/* Search Input Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stalls, dishes (Vada Pav, Chai, Dosa, Thali)..."
            className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white border border-slate-200 shadow-xs text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Veg Filter */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Results
          </button>
          <button
            onClick={() => setActiveTab('dishes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'dishes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dishes ({filteredDishes.length})
          </button>
          <button
            onClick={() => setActiveTab('shops')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'shops' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stalls ({filteredShops.length})
          </button>
        </div>

        {/* Pure Veg Pill */}
        <button
          onClick={() => setOnlyVeg(!onlyVeg)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
            onlyVeg
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          Pure Veg
        </button>
      </div>

      {/* Categories Horizontal Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedCategory === 'all'
              ? 'bg-orange-500 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(selectedCategory === c.id ? 'all' : c.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === c.id
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Searching local stalls and menus...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dishes List */}
          {(activeTab === 'all' || activeTab === 'dishes') && filteredDishes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                  Popular Dishes ({filteredDishes.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredDishes.slice(0, activeTab === 'dishes' ? 30 : 6).map(({ item, shop }) => (
                  <MenuItemCard key={`${shop.id}-${item.id}`} item={item} shop={shop} />
                ))}
              </div>
            </div>
          )}

          {/* Stalls List */}
          {(activeTab === 'all' || activeTab === 'shops') && filteredShops.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-500" />
                  Food Stalls & Counters ({filteredShops.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredShops.slice(0, activeTab === 'shops' ? 30 : 6).map((shop) => (
                  <ShopCard key={shop.id} shop={shop} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredDishes.length === 0 && filteredShops.length === 0 && (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8 max-w-md mx-auto">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-500">
                <UtensilsCrossed className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">No items found</h3>
              <p className="text-xs text-slate-500 mb-5">
                We couldn't find any dishes or food stalls matching &ldquo;{query}&rdquo;. Try another dish or check your filters.
              </p>
              <button
                onClick={() => {
                  setQuery('');
                  setSelectedCategory('all');
                  setOnlyVeg(false);
                }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
