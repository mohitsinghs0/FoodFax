import React from 'react';
import { useCart } from '../../context/CartContext';
import { useRouter } from '../../context/RouterContext';
import { AlertTriangle, Bike, Car, MapPin, X, ArrowRight, ShieldAlert } from 'lucide-react';

export const DistanceWarningModal: React.FC = () => {
  const { distanceWarningData, confirmVehiclePickup, cancelDistanceWarning } = useCart();
  const { navigate } = useRouter();

  if (!distanceWarningData) return null;

  const { shop, distanceKm, isVehicleAllowed, userArea } = distanceWarningData;

  const handleCancelAndGoHome = () => {
    cancelDistanceWarning();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 relative overflow-hidden">
        
        {/* Close Icon */}
        <button
          onClick={cancelDistanceWarning}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close distance notice"
        >
          <X className="w-5 h-5" />
        </button>

        {isVehicleAllowed ? (
          /* ========================================================== */
          /* CASE 1: Between 2.0 km and 4.0 km (Allowed with Bike/Car)  */
          /* ========================================================== */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                  Distance Notice ({distanceKm} km away)
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 truncate">
                  Stall is Outside 2 km Walking Range
                </h3>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <p className="leading-relaxed">
                <strong className="text-slate-900 dark:text-white">{shop.name}</strong> is{' '}
                <strong className="text-orange-600 dark:text-orange-400 font-extrabold">{distanceKm} km</strong> away from{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{userArea}</span>.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Walking back and forth may let your food turn cold. We recommend ordering from food counters located within your <strong>2 km walking zone</strong>.
              </p>
            </div>

            {/* Vehicle Mode Offer (Up to 4 km) */}
            <div className="p-3.5 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 space-y-2">
              <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300 font-bold text-xs">
                <div className="flex items-center gap-1">
                  <Bike className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <Car className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <span>Traveling by Bike or Car? (Up to 4 km supported)</span>
              </div>
              <p className="text-[11px] text-orange-700/90 dark:text-orange-300/80 leading-relaxed">
                If you have a two-wheeler or car for quick counter collection, you can proceed with ordering up to 4 km.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                id="distance-confirm-vehicle-btn"
                onClick={confirmVehiclePickup}
                className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm transition-all shadow-sm shadow-orange-600/25 flex items-center justify-center gap-2"
              >
                <Bike className="w-4 h-4" />
                <span>Yes, I am on Bike / Car — Proceed with Order</span>
              </button>

              <button
                type="button"
                id="distance-cancel-nearby-btn"
                onClick={handleCancelAndGoHome}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.99] text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Find Closer Stalls (Within 2 km)</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================== */
          /* CASE 2: Exceeds 4.0 km (Rejected / Strict Pickup Limit)   */
          /* ========================================================== */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                  Pickup Limit Exceeded ({distanceKm} km away)
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 truncate">
                  Counter Too Far for Self-Pickup
                </h3>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <p className="leading-relaxed">
                <strong className="text-slate-900 dark:text-white">{shop.name}</strong> is{' '}
                <strong className="text-rose-600 dark:text-rose-400 font-extrabold">{distanceKm} km</strong> away from{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{userArea}</span>.
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                FoodFax live orders have a strict maximum pickup limit of <strong>4 km</strong> (even by bike or car) to ensure street food remains fresh, piping hot, and ready right at the counter.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <span>Please order from food stalls located within your 2 km walking or 4 km vehicle radius.</span>
            </div>

            {/* Action Button */}
            <div className="pt-1">
              <button
                type="button"
                id="distance-find-nearby-btn"
                onClick={handleCancelAndGoHome}
                className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm transition-all shadow-sm shadow-orange-600/25 flex items-center justify-center gap-2"
              >
                <span>Find Closer Stalls Near Me</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

