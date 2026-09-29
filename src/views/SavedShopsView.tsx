import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { shopService } from '../services/shopService';
import { Shop } from '../types';
import { ShopCard } from '../components/shop/ShopCard';
import { Heart, ArrowLeft, Store } from 'lucide-react';

export const SavedShopsView: React.FC = () => {
  const { navigate, goBack } = useRouter();
  const [savedShops, setSavedShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSavedShops = async () => {
    setLoading(true);
    try {
      const shops = await shopService.getSavedShops();
      setSavedShops(shops);
    } catch (err) {
      console.error('Failed to load saved shops:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedShops();
  }, []);

  const handleToggleSaved = (shopId: string) => {
    shopService.toggleSaveShop(shopId);
    setSavedShops((prev) => prev.filter((s) => s.id !== shopId));
  };

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500 fill-red-500" />
            Saved Stalls & Tapris
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quick access to your favorite local food counters
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium">Loading saved stalls...</p>
        </div>
      ) : savedShops.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {savedShops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              isSaved={true}
              onToggleSaved={handleToggleSaved}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">No saved stalls yet</h2>
          <p className="text-xs text-slate-500 mb-6">
            Tap the heart icon on any stall to save it here for fast ordering.
          </p>
          <button
            onClick={() => navigate('/shops')}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            Discover Stalls
          </button>
        </div>
      )}
    </div>
  );
};
