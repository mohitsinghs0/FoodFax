import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { shopService } from '../../services/shopService';
import { Shop } from '../../types';
import { X, QrCode, ArrowRight, Sparkles, MapPin, Search, Plane } from 'lucide-react';

interface QRScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRScanModal: React.FC<QRScanModalProps> = ({ isOpen, onClose }) => {
  const { navigate } = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [activeTab, setActiveTab] = useState<'nearby' | 'remote' | 'manual'>('nearby');
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShops(shopService.getStoredShops());
      setScanStatus(null);
      setManualCode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScanShop = (shopSlug: string, tableNum?: string) => {
    setScanStatus(`Scanned "${shopSlug}" successfully! Opening menu...`);
    setTimeout(() => {
      onClose();
      if (tableNum) {
        sessionStorage.setItem('foodflow_prefill_table', tableNum);
      } else {
        sessionStorage.removeItem('foodflow_prefill_table');
      }
      navigate(`/shop/${shopSlug}`);
    }, 400);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toLowerCase().replace(/^https?:\/\/.*\/shop\//, '');
    if (!clean) return;

    // Check if matching shop exists
    const match = shops.find(
      (s) => s.slug === clean || s.id === clean || s.name.toLowerCase().includes(clean)
    );

    if (match) {
      handleScanShop(match.slug);
    } else {
      // Direct navigation attempt
      handleScanShop(clean);
    }
  };

  const nearbyShops = shops.filter((s) => (s.location?.distanceKm ?? 0) < 50);
  const remoteShops = shops.filter((s) => (s.location?.distanceKm ?? 0) >= 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">
                Scan Stall / Table QR
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Scan at counter or explore remote shops (100+ km)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Graphic with simulated scanner */}
        <div className="py-3">
          <div className="relative aspect-video rounded-xl bg-slate-950 flex flex-col items-center justify-center text-center p-4 overflow-hidden border border-slate-800">
            {/* Viewfinder Corners */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-orange-500 rounded-tl-sm" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-orange-500 rounded-tr-sm" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-orange-500 rounded-bl-sm" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-orange-500 rounded-br-sm" />

            <div className="w-11 h-11 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center mb-1.5 animate-pulse">
              <QrCode className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-white">
              {scanStatus || 'Point camera at any FoodFlow stall QR code'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">
              Direct live link: <code className="text-orange-400 font-mono">foodflow.app/shop/[shopId]</code>
            </p>
          </div>
        </div>

        {/* Category Tabs: Nearby / 100km+ Remote Cities / Enter Code */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('nearby')}
            className={`py-1.5 px-2 rounded-lg transition-all ${
              activeTab === 'nearby' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nearby
          </button>
          <button
            onClick={() => setActiveTab('remote')}
            className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'remote' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plane className="w-3 h-3" />
            <span>100km+ Cities</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-1.5 px-2 rounded-lg transition-all ${
              activeTab === 'manual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Enter ID / URL
          </button>
        </div>

        {/* Content Tab 1: Nearby Stalls */}
        {activeTab === 'nearby' && (
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Tap a Counter to Simulate Scan
            </p>

            {nearbyShops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => handleScanShop(shop.slug)}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={shop.image}
                    alt={shop.name}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-orange-600 truncate">
                        {shop.name}
                      </h4>
                      {shop.isOpen ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {shop.location?.landmark || shop.stallType} • {shop.location?.distanceKm ? `${shop.location.distanceKm} km` : '0.1 km'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate-400 group-hover:text-orange-600 pl-2">
                  <span className="text-[10px] font-bold">Scan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}

            {/* Table Specific Dine-in QR Simulator */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => handleScanShop('college-canteen', 'Table 14')}
                className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Scan College Canteen Table #14 QR
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Pre-fills Dine-in Table 14 for instant ordering
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {/* Content Tab 2: 100km+ Remote Cities */}
        {activeTab === 'remote' && (
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pr-1">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Visiting another city?</span> When you travel 100km+ away, scan the shop’s counter QR code to bypass distance filters and access their complete menu instantly.
            </div>

            {remoteShops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => handleScanShop(shop.slug)}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={shop.image}
                    alt={shop.name}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-orange-600 truncate">
                        {shop.name}
                      </h4>
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                        {Math.round(shop.location?.distanceKm || 100)} km away
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {shop.location?.landmark || shop.location?.address}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate-400 group-hover:text-orange-600 pl-2">
                  <span className="text-[10px] font-bold">Open Menu</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Content Tab 3: Manual Stall ID or QR URL Entry */}
        {activeTab === 'manual' && (
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1 pt-1">
            <form onSubmit={handleManualSubmit} className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Enter Shop ID, Slug, or QR Code text:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. pune-vada-pav, delhi-chaat-hub, sharma-vada-pav..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm"
              >
                Scan & Open Shop Menu
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
              <p className="font-semibold text-slate-700">Quick Test IDs:</p>
              <div className="flex flex-wrap gap-1.5">
                {['sharma-vada-pav', 'pune-vada-pav', 'delhi-chaat-hub', 'bangalore-tiffin'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleScanShop(id)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-700 text-[10px] font-mono transition-colors"
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
