import React from 'react';
import { MapPin, Navigation, ShieldCheck, X } from 'lucide-react';

interface LocationConsentModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
  onSelectManualCity?: () => void;
}

export const LocationConsentModal: React.FC<LocationConsentModalProps> = ({
  isOpen,
  onAllow,
  onDeny,
  onSelectManualCity,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 text-center relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-consent-title"
      >
        <button
          onClick={onDeny}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Location Icon */}
        <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-xs">
          <Navigation className="w-7 h-7 stroke-[2.2] animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <h3 id="location-consent-title" className="text-base sm:text-lg font-black text-slate-900">
            Allow Location Access?
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            FoodFax uses your device location to show authentic street food stalls, tapris, and canteens closest to your current spot in Vasai-Virar.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 flex items-start gap-2 text-left">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>We only access your location while browsing stalls. No background tracking is performed.</span>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onAllow}
            className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-md shadow-orange-600/20 transition-all cursor-pointer min-h-[44px]"
          >
            Allow Location Access
          </button>

          {onSelectManualCity && (
            <button
              type="button"
              onClick={onSelectManualCity}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer min-h-[40px]"
            >
              Choose Area Manually (e.g. Vasai West)
            </button>
          )}

          <button
            type="button"
            onClick={onDeny}
            className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors cursor-pointer"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};

