import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { Search, Mic, X, QrCode, Zap, Utensils, Sparkles, ArrowRight } from 'lucide-react';

export interface ImmersiveHeroStageProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onVoiceSearch: () => void;
  onlyVeg: boolean;
  onToggleVeg: () => void;
  onOpenQRScanner: () => void;
}

const SEARCH_SUGGESTIONS = [
  'Vada Pav',
  'Masala Dosa',
  'Kadak Chai',
  'Paneer Tikka Roll',
  'Momos & Chowmein',
  'Samosa Chaat',
  'Cold Coffee',
  'Pav Bhaji',
];

export const ImmersiveHeroStage: React.FC<ImmersiveHeroStageProps> = ({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onVoiceSearch,
  onlyVeg,
  onToggleVeg,
  onOpenQRScanner,
}) => {
  const { navigate } = useRouter();
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Smooth rotating placeholder suggestions
  useEffect(() => {
    const timer = setInterval(() => {
      setSuggestionIndex((prev) => (prev + 1) % SEARCH_SUGGESTIONS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const currentPlaceholder = SEARCH_SUGGESTIONS[suggestionIndex];

  return (
    <section
      aria-label="Hero discovery section"
      className="relative w-full bg-gradient-to-b from-orange-50/80 via-amber-50/40 to-white pt-20 sm:pt-24 pb-8 sm:pb-10 px-4 sm:px-6 lg:px-8 border-b border-slate-100"
    >
      <div className="max-w-4xl mx-auto text-center space-y-5">
        
        {/* Subtle, elegant platform badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100/80 border border-orange-200/60 text-orange-800 text-xs font-semibold tracking-wide shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          <span>Local Street Food & Stalls</span>
        </div>

        {/* Primary Clear, Professional Heading */}
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Order fresh food from nearby stalls
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-lg mx-auto">
            Skip the queue with quick counter pickup & live token tracking.
          </p>
        </div>

        {/* Clean, Modern Search Bar Container */}
        <div className="pt-1">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            
            {/* Search Input Box */}
            <form
              onSubmit={onSearchSubmit}
              className="flex-1 relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all px-4 py-3"
            >
              <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search for "${currentPlaceholder}"...`}
                className="w-full text-sm font-medium text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 mr-1"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Voice Search Button */}
            <button
              type="button"
              onClick={onVoiceSearch}
              className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-200 shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center shrink-0 transition-all cursor-pointer"
              title="Voice Search"
              aria-label="Voice search"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* QR Scanner Shortcut */}
            <button
              type="button"
              onClick={onOpenQRScanner}
              className="w-12 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center shrink-0 transition-all cursor-pointer"
              title="Scan Stall QR Code"
              aria-label="Scan QR Code"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Discovery Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={onToggleVeg}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              onlyVeg
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-2xs'
                : 'bg-white/80 hover:bg-white text-slate-600 border-slate-200/80 shadow-2xs'
            }`}
          >
            <span className="w-2 h-2 rounded-xs border border-emerald-600 flex items-center justify-center p-0.2">
              <span className="w-1 h-1 rounded-full bg-emerald-600" />
            </span>
            <span>Pure Veg Only</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/shops?filter=fast')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Fast Pickup (≤10m)</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/shops?filter=popular')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <Utensils className="w-3.5 h-3.5 text-orange-500" />
            <span>Top Rated</span>
          </button>
        </div>

      </div>
    </section>
  );
};
