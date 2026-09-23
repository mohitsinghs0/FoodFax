import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { shopService } from '../services/shopService';
import { Shop, StallType } from '../types';
import { ShopCard } from '../components/shop/ShopCard';
import { Store, Search, Filter, MapPin, Sparkles, ArrowLeft } from 'lucide-react';

const STALL_TYPES: (StallType | 'All')[] = [
  'All',
  'Thela / Food Stall',
  'College Canteen',
  'Tea Tapri',
  'Fast Food Counter',
  'Sandwich Cart',
  'Juice Point',
  'Chaat Cart',
  'Tiffin Cart',
];

export const ShopsView: React.FC = () => {
  const { navigate, goBack } = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStallType, setSelectedStallType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyVeg, setOnlyVeg] = useState(false);

  useEffect(() => {
    const loadShops = async () => {
      setLoading(true);
      try {
        const loaded = await shopService.getNearbyShops();
        setShops(loaded);
      } catch (err) {
        console.error('Failed to load shops:', err);
      } finally {
        setLoading(false);
      }
    };
    loadShops();
  }, []);

  const filteredShops = shops.filter((s) => {
    const matchType = selectedStallType === 'All' || s.stallType === selectedStallType;
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.location.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    const matchOpen = !onlyOpen || s.isOpen;
    const matchVeg = !onlyVeg || s.isPureVeg;

    return matchType && matchSearch && matchOpen && matchVeg;
  });

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Store className="w-6 h-6 text-orange-500" />
              All Food Counters & Stalls
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Browse authentic local thelas, tapris, college canteens & food kiosks
            </p>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stall name or place..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-200/80">
        {/* Stall Types Horizontal Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {STALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedStallType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedStallType === t
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setOnlyOpen(!onlyOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              onlyOpen
                ? 'bg-orange-50 border-orange-500 text-orange-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Open Now
          </button>
          <button
            onClick={() => setOnlyVeg(!onlyVeg)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              onlyVeg
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Pure Veg
          </button>
        </div>
      </div>

      {/* Grid of Shops */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Loading food stalls...</p>
        </div>
      ) : filteredShops.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredShops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8 max-w-md mx-auto">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base mb-1">No matching stalls found</h3>
          <p className="text-xs text-slate-500 mb-4">
            Try choosing another stall category or clearing search filters.
          </p>
          <button
            onClick={() => {
              setSelectedStallType('All');
              setSearchQuery('');
              setOnlyOpen(false);
              setOnlyVeg(false);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-orange-600"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};
