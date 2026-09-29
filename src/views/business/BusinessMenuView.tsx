import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { menuService } from '../../services/menuService';
import { shopService } from '../../services/shopService';
import { MenuItem, ShopCategory } from '../../types';
import { VegBadge } from '../../components/common/VegBadge';
import { 
  UtensilsCrossed, 
  Plus, 
  Edit3, 
  Trash2, 
  Flame, 
  Search, 
  Check, 
  X,
  AlertCircle 
} from 'lucide-react';

export const BusinessMenuView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentBusiness, activeShopId, currentUser } = useAuth();
  const storedOwnerShop = !activeShopId && !currentBusiness?.id && !currentUser?.shopId && currentUser
    ? shopService.getStoredShops().find((s: any) => s.ownerId === currentUser.id)
    : null;
  const targetShopId = activeShopId || currentBusiness?.id || currentUser?.shopId || storedOwnerShop?.id || '';

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  const loadMenu = async () => {
    if (!targetShopId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [m, c] = await Promise.all([
        menuService.getMenuItems(targetShopId),
        shopService.getCategories(),
      ]);
      setItems(m);
      setCategories(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, [targetShopId]);

  if (!targetShopId) {
    return (
      <BusinessLayout activeTab="menu">
        <div className="py-16 px-4 max-w-lg mx-auto text-center space-y-4">
          <h2 className="text-xl font-black text-slate-900">Set Up Your Stall Menu</h2>
          <p className="text-xs text-slate-500">
            Please register your stall first to add dishes and manage your counter menu items.
          </p>
          <button
            onClick={() => navigate('/setup-shop')}
            className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Register My Stall Counter
          </button>
        </div>
      </BusinessLayout>
    );
  }

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await menuService.toggleAvailability(item.id, !item.isAvailable);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await menuService.deleteMenuItem(itemToDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
    } catch (err) {
      console.error(err);
    } finally {
      setItemToDelete(null);
    }
  };

  const filtered = items.filter((i) => {
    const matchCat = selectedCat === 'all' || i.categoryId === selectedCat;
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <BusinessLayout activeTab="menu">
      <div className="space-y-5 pb-20">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-orange-500" />
              Counter Menu Catalog ({items.length})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Toggle availability instantly or add new items
            </p>
          </div>

          <button
            onClick={() => navigate('/business/menu/new')}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dish</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedCat('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCat === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Items ({items.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCat(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCat === c.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="relative sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-medium">Loading catalog...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-4 transition-all flex items-center justify-between gap-4 ${
                  item.isAvailable ? 'border-slate-200/90' : 'border-slate-200/60 bg-slate-50/70 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                    <img
                      src={item.image?.trim() ? item.image : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <VegBadge isVeg={item.isVeg} size="sm" />
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {item.name}
                      </h3>
                      {item.isBestseller && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                          Hot
                        </span>
                      )}
                    </div>
                    <p className="font-black text-xs text-slate-900 mt-1">₹{item.price}</p>
                  </div>
                </div>

                {/* Stock Toggle and Edit Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleAvailability(item)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors ${
                      item.isAvailable
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    {item.isAvailable ? 'In Stock' : 'Sold Out'}
                  </button>

                  <button
                    onClick={() => navigate(`/business/menu/${item.id}`)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    title="Edit Item"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setItemToDelete(item)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                    title="Delete Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8">
            <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm mb-1">No items found</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add popular snacks, beverages, or meals to your stall menu.
            </p>
            <button
              onClick={() => navigate('/business/menu/new')}
              className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold"
            >
              Add First Item
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Remove Menu Item?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to remove <strong className="text-slate-800 font-bold">"{itemToDelete.name}"</strong> from your stall menu?
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                >
                  Yes, Remove
                </button>
                <button
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BusinessLayout>
  );
};
