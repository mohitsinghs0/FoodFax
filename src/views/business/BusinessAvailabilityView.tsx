import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { menuService } from '../../services/menuService';
import { shopService } from '../../services/shopService';
import { MenuItem, Shop } from '../../types';
import { VegBadge } from '../../components/common/VegBadge';
import { Zap, Store, Clock, Flame, AlertCircle, Check, X } from 'lucide-react';

export const BusinessAvailabilityView: React.FC = () => {
  const { currentBusiness, activeShopId } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, m] = await Promise.all([
          shopService.getShop(targetShopId),
          menuService.getMenuItems(targetShopId),
        ]);
        if (s) setShop(s);
        setItems(m);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [targetShopId]);

  const handleToggleShopOpen = async () => {
    if (!shop) return;
    try {
      const updated = await shopService.updateShop(shop.id, { isOpen: !shop.isOpen });
      setShop(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleRushMode = async () => {
    if (!shop) return;
    try {
      const updated = await shopService.updateShop(shop.id, { isRushHour: !shop.isRushHour });
      setShop(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleItem = async (item: MenuItem) => {
    try {
      await menuService.toggleAvailability(item.id, !item.isAvailable);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i))
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <BusinessLayout activeTab="availability">
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Live Stall Controls & Item Stock (86-ing)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Instantly mark items as sold-out or toggle rush hours during peak canteen crowds
          </p>
        </div>

        {/* Master Stall Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Stall Counter Status
              </span>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {shop?.isOpen ? 'Currently Open & Taking Orders' : 'Counter is Closed'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Toggle when closing for the day or taking a break
              </p>
            </div>

            <button
              onClick={handleToggleShopOpen}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-colors ${
                shop?.isOpen
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-rose-500 text-white shadow-xs'
              }`}
            >
              {shop?.isOpen ? 'Open' : 'Closed'}
            </button>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Rush Hour Mode
              </span>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {shop?.isRushHour ? 'Rush Mode ACTIVE' : 'Normal Pace'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Adds +5 to 10 mins automatically to token wait estimates
              </p>
            </div>

            <button
              onClick={handleToggleRushMode}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-colors ${
                shop?.isRushHour
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {shop?.isRushHour ? 'Active' : 'Off'}
            </button>
          </div>
        </div>

        {/* 1-Tap Quick 86 List */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">
                1-Tap Stock & Out-of-Stock (86)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quickly tap to toggle sold-out ingredients or finished batches
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {items.filter((i) => i.isAvailable).length} / {items.length} In Stock
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleToggleItem(item)}
                className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                  item.isAvailable
                    ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 text-slate-900'
                    : 'border-rose-200 bg-rose-50/40 hover:bg-rose-50 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <VegBadge isVeg={item.isVeg} size="sm" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate">{item.name}</p>
                    <p className="text-[11px] font-semibold text-slate-400">₹{item.price}</p>
                  </div>
                </div>

                <span
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    item.isAvailable
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {item.isAvailable ? 'In Stock' : 'Sold Out'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
};
