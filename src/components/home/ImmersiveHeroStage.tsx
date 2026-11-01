import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../../context/RouterContext';
import { Search, Mic, X, ChevronRight, Sparkles } from 'lucide-react';

export interface HeroSlide {
  id: string;
  theme: 'purple' | 'coffee' | 'crimson' | 'gold';
  isDark: boolean;
  bgGradient: string;
  badge?: string;
  titleTop?: string;
  titleMain: string;
  subtitle?: string;
  ctaText: string;
  ctaAction: string;
  searchPhrases: string[];
  renderDecorations: () => React.ReactNode;
}

export interface ImmersiveHeroStageProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onVoiceSearch: () => void;
  onlyVeg: boolean;
  onToggleVeg: () => void;
  onOpenQRScanner: () => void;
}

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
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // 4 Curated Thematic Slides matching Zomato screenshots
  const slides: HeroSlide[] = [
    {
      id: 'homely',
      theme: 'purple',
      isDark: true,
      bgGradient: 'from-[#220738] via-[#3d0f5c] to-[#1a042c]',
      badge: 'INTRODUCING',
      titleMain: 'HOMELY subscriptions',
      ctaText: 'Explore now',
      ctaAction: '/shops?filter=thali',
      searchPhrases: ['Date night', 'homestyle thali', 'rajma chawal', 'dal tadka'],
      renderDecorations: () => (
        <>
          {/* Floating Bowl of Rajma Chawal on Left */}
          <div className="absolute -bottom-2 -left-2 sm:left-4 w-28 sm:w-36 transition-transform duration-700 animate-float-slow pointer-events-none drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]">
            <img
              src="https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=260&q=80"
              alt="Homely Rajma Chawal"
              className="w-full h-24 sm:h-28 object-cover rounded-full border-2 border-amber-200/40 shadow-2xl rotate-[-6deg]"
              loading="lazy"
            />
          </div>

          {/* Floating Steaming Golden Khichdi Bowl on Right */}
          <div className="absolute top-1 sm:top-2 -right-2 sm:right-4 w-28 sm:w-36 transition-transform duration-700 animate-float-reverse pointer-events-none drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]">
            <img
              src="https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=260&q=80"
              alt="Comfort Khichdi"
              className="w-full h-24 sm:h-28 object-cover rounded-full border-2 border-amber-200/40 shadow-2xl rotate-[8deg]"
              loading="lazy"
            />
          </div>

          {/* Floating Fresh Lemon Slice (Top Left) */}
          <div className="absolute top-2 left-6 sm:left-14 w-8 h-8 rounded-full bg-yellow-400 border border-yellow-200 shadow-md flex items-center justify-center text-xs animate-float-spin pointer-events-none opacity-90">
            🍋
          </div>

          {/* Floating Fresh Green Chili (Bottom Right) */}
          <div className="absolute bottom-2 right-8 sm:right-16 text-2xl animate-float-reverse pointer-events-none drop-shadow-md">
            🌶️
          </div>
        </>
      ),
    },
    {
      id: 'coffee',
      theme: 'coffee',
      isDark: true,
      bgGradient: 'from-[#25100a] via-[#431911] to-[#1c0a06]',
      titleMain: 'COFFEE subscriptions',
      ctaText: 'Explore now',
      ctaAction: '/shops?filter=tea-coffee',
      searchPhrases: ['bread', 'filter coffee', 'kadak chai', 'cappuccino'],
      renderDecorations: () => (
        <>
          {/* Subtle Concentric Rings Backdrop */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
            <div className="w-72 h-72 rounded-full border-2 border-amber-200" />
            <div className="w-96 h-96 rounded-full border border-amber-200 absolute" />
          </div>

          {/* Takeaway Coffee Cup (Bottom Left) */}
          <div className="absolute -bottom-1 left-1 sm:left-6 w-24 sm:w-32 animate-float-slow pointer-events-none drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]">
            <img
              src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=260&q=80"
              alt="Hot Coffee Cup"
              className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-2xl border-2 border-amber-300/30 shadow-2xl rotate-[-8deg]"
              loading="lazy"
            />
          </div>

          {/* Ceramic Latte Art Cup (Top Right) */}
          <div className="absolute top-0 right-1 sm:right-6 w-24 sm:w-32 animate-float-reverse pointer-events-none drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]">
            <img
              src="https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=260&q=80"
              alt="Latte Art"
              className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full border-2 border-amber-300/40 shadow-2xl rotate-[12deg]"
              loading="lazy"
            />
          </div>

          {/* Floating Coffee Beans */}
          <div className="absolute top-4 left-10 text-xl animate-float-spin pointer-events-none opacity-80">
            ☕
          </div>
          <div className="absolute bottom-4 right-12 text-sm animate-float-slow pointer-events-none opacity-70">
            ✨
          </div>
        </>
      ),
    },
    {
      id: 'discount-50',
      theme: 'crimson',
      isDark: true,
      bgGradient: 'from-[#7f1d1d] via-[#b91c1c] to-[#991b1b]',
      titleTop: 'ITEMS AT',
      titleMain: '50% OFF',
      subtitle: 'with FREE counter pickup',
      ctaText: 'Order now',
      ctaAction: '/search?discount=50',
      searchPhrases: ['khichdi', 'schezwan noodles', 'vada pav', 'paneer roll'],
      renderDecorations: () => (
        <>
          {/* Comic Starburst Rays Backdrop */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15 overflow-hidden">
            <div className="w-[500px] h-[500px] bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-white via-transparent to-white/20 animate-spin-extremely-slow" />
          </div>

          {/* Plated Dishes Stack in Center-Right */}
          <div className="absolute -bottom-2 right-2 sm:right-10 w-32 sm:w-44 animate-float-slow pointer-events-none drop-shadow-[0_12px_25px_rgba(0,0,0,0.6)]">
            <img
              src="https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80"
              alt="Hakka Noodles & Manchurian"
              className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-full border-2 border-yellow-300/60 shadow-2xl"
              loading="lazy"
            />
          </div>

          {/* Floating Yellow % Tickets */}
          <div className="absolute top-2 left-4 sm:left-12 px-2.5 py-1 bg-yellow-400 text-slate-900 font-black text-xs rounded-md shadow-lg border border-yellow-200 rotate-[-14deg] animate-float-slow pointer-events-none">
            🎟️ 50%
          </div>
          <div className="absolute bottom-2 left-8 sm:left-24 px-2 py-0.5 bg-yellow-300 text-slate-900 font-extrabold text-[10px] rounded-md shadow-md border border-yellow-100 rotate-[10deg] animate-float-reverse pointer-events-none">
            % OFF
          </div>
          <div className="absolute top-3 right-6 sm:right-28 px-2 py-0.5 bg-white text-rose-600 font-black text-[11px] rounded-md shadow-md rotate-[12deg] animate-float-spin pointer-events-none">
            SAVE ₹100
          </div>
        </>
      ),
    },
    {
      id: 'gold-delivery',
      theme: 'gold',
      isDark: false,
      bgGradient: 'from-[#fef3c7] via-[#fde68a] to-[#f59e0b]',
      titleTop: 'FREE DELIVERY',
      titleMain: 'above ₹99',
      ctaText: 'Join GOLD at ₹1',
      ctaAction: '/profile',
      searchPhrases: ['soup', 'vada pav', 'cheese burst pizza', 'masala dosa'],
      renderDecorations: () => (
        <>
          {/* Champagne Sparkle Particles */}
          <div className="absolute inset-0 pointer-events-none opacity-30 flex items-center justify-around">
            <Sparkles className="w-6 h-6 text-amber-700 animate-pulse" />
            <Sparkles className="w-4 h-4 text-amber-800 animate-ping" />
            <Sparkles className="w-7 h-7 text-yellow-600 animate-pulse" />
          </div>

          {/* Floating Gold Coin Left */}
          <div className="absolute bottom-3 left-2 sm:left-8 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border-2 border-yellow-100 shadow-xl flex items-center justify-center font-black text-amber-950 text-sm rotate-[-12deg] animate-float-slow pointer-events-none">
            ₹
          </div>

          {/* Floating Gold Coin Right with Delivery Scooter */}
          <div className="absolute top-2 right-2 sm:right-8 w-14 h-14 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border-2 border-yellow-100 shadow-xl flex items-center justify-center font-black text-amber-950 text-base rotate-[15deg] animate-float-reverse pointer-events-none">
            🛵
          </div>
        </>
      ),
    },
  ];

  const currentSlide = slides[activeSlideIndex];

  // Auto-advance slides every 5000ms unless paused by user interaction
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, slides.length]);

  // Rotate search placeholder text every 2500ms
  useEffect(() => {
    const pTimer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % currentSlide.searchPhrases.length);
    }, 2500);
    return () => clearInterval(pTimer);
  }, [currentSlide]);

  // Synchronize dynamic hero theme with Header
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('foodfax:hero-theme-changed', {
        detail: {
          isDark: currentSlide.isDark,
          textColor: currentSlide.isDark ? 'text-white' : 'text-amber-950',
          subtextColor: currentSlide.isDark ? 'text-white/80' : 'text-amber-900/80',
        },
      })
    );
  }, [currentSlide]);

  // Touch Swipe Handlers for Mobile Carousels
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (diff > 45) {
      // Swiped Left -> Next Slide
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    } else if (diff < -45) {
      // Swiped Right -> Prev Slide
      setActiveSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }
    touchStartXRef.current = null;
  };

  const currentSearchPlaceholder = currentSlide.searchPhrases[placeholderIndex % currentSlide.searchPhrases.length];

  return (
    <section
      aria-label="Promotional Hero Showcase"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full overflow-hidden transition-colors duration-700 ease-in-out bg-gradient-to-b ${currentSlide.bgGradient} pt-20 sm:pt-22 pb-6 sm:pb-8 px-3.5 sm:px-6 lg:px-8 select-none`}
    >
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
        
        {/* 1. FLOATING SEARCH CAPSULE (White Pill + Mic + VEG Switch) */}
        <div className="flex items-center gap-2 sm:gap-2.5 max-w-3xl mx-auto relative z-20">
          {/* Main Search Input Capsule */}
          <form
            onSubmit={onSearchSubmit}
            className="flex-1 relative flex items-center bg-white rounded-full border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.14)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] focus-within:ring-2 focus-within:ring-emerald-500/40 transition-all px-3.5 py-2.5 sm:py-3"
          >
            <Search className="w-5 h-5 text-emerald-600 shrink-0 mr-2.5 stroke-[2.4]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search "${currentSearchPlaceholder}"`}
              className="w-full text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 mr-1"
                aria-label="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Voice Search Circle (Pink Mic Icon matching Zomato) */}
          <button
            type="button"
            onClick={onVoiceSearch}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.14)] hover:bg-rose-50 active:scale-95 text-rose-500 flex items-center justify-center shrink-0 transition-all cursor-pointer"
            title="Search with Voice"
            aria-label="Voice search for food"
          >
            <Mic className="w-4.5 h-4.5 stroke-[2.2]" />
          </button>

          {/* VEG Quick Switch Button (Matching Zomato VEG switch) */}
          <div className="flex flex-col items-center shrink-0">
            <span className={`text-[9px] font-black tracking-wider leading-none mb-1 ${currentSlide.isDark ? 'text-white' : 'text-amber-950'}`}>
              VEG
            </span>
            <button
              type="button"
              onClick={onToggleVeg}
              aria-pressed={onlyVeg}
              className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 shadow-md ${
                onlyVeg ? 'bg-emerald-500' : 'bg-white/80'
              }`}
              title="Toggle Pure Veg Stalls"
            >
              <span
                className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                  onlyVeg ? 'translate-x-4 bg-white' : 'translate-x-0 bg-slate-300'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 2. THEMATIC ANIMATED ADVERTISEMENT STAGE */}
        <div className="relative min-h-[175px] sm:min-h-[200px] flex flex-col items-center justify-center text-center px-2 py-4 sm:py-6 overflow-hidden">
          
          {/* Dynamic 3D Floating Decorations */}
          {currentSlide.renderDecorations()}

          {/* Main Slide Typography & Centerpiece */}
          <div className="relative z-10 max-w-md mx-auto space-y-2.5 animate-in fade-in zoom-in-95 duration-500">
            {/* Badge (e.g. INTRODUCING) */}
            {currentSlide.badge && (
              <div className="inline-block px-3 py-0.5 rounded-full bg-white/90 text-slate-900 font-black text-[9px] sm:text-[10px] tracking-widest uppercase shadow-md border border-white">
                {currentSlide.badge}
              </div>
            )}

            {/* Slide Title */}
            <div>
              {currentSlide.titleTop && (
                <div className={`text-xs sm:text-sm font-black uppercase tracking-wider mb-0.5 ${
                  currentSlide.isDark ? 'text-yellow-300' : 'text-amber-900'
                }`}>
                  {currentSlide.titleTop}
                </div>
              )}
              <h2
                className={`text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] ${
                  currentSlide.isDark ? 'text-white' : 'text-amber-950'
                }`}
              >
                {currentSlide.titleMain}
              </h2>
              {currentSlide.subtitle && (
                <p className={`text-xs sm:text-sm font-bold mt-1 ${
                  currentSlide.isDark ? 'text-white/90' : 'text-amber-900'
                }`}>
                  {currentSlide.subtitle}
                </p>
              )}
            </div>

            {/* CTA Pill Button (e.g. Explore now > / Order now >) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate(currentSlide.ctaAction)}
                className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-black text-xs sm:text-sm shadow-xl active:scale-95 transition-all ${
                  currentSlide.isDark
                    ? 'bg-black text-white hover:bg-slate-900 border border-white/20'
                    : 'bg-amber-950 text-white hover:bg-amber-900 border border-amber-800'
                }`}
              >
                <span>{currentSlide.ctaText}</span>
                <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. CAROUSEL DOT INDICATORS */}
        <div className="flex items-center justify-center gap-1.5 pt-1 relative z-10" aria-label="Hero slide indicators">
          {slides.map((s, idx) => {
            const isActive = idx === activeSlideIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                aria-label={`Go to slide ${idx + 1}: ${s.titleMain}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isActive
                    ? `w-6 ${currentSlide.isDark ? 'bg-white' : 'bg-amber-950 shadow-xs'}`
                    : `w-1.5 ${currentSlide.isDark ? 'bg-white/40 hover:bg-white/60' : 'bg-amber-950/30 hover:bg-amber-950/50'}`
                }`}
              />
            );
          })}
        </div>

      </div>

      {/* Inline Keyframe Animations for 3D Floating Elements */}
      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-7px) rotate(3deg); }
        }
        @keyframes floatReverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(7px) rotate(-3deg); }
        }
        @keyframes floatSpin {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(10deg); }
        }
        @keyframes spinExtremelySlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-float-slow {
          animation: floatSlow 3.8s ease-in-out infinite;
        }
        .animate-float-reverse {
          animation: floatReverse 4.2s ease-in-out infinite;
        }
        .animate-float-spin {
          animation: floatSpin 3.2s ease-in-out infinite;
        }
        .animate-spin-extremely-slow {
          animation: spinExtremelySlow 30s linear infinite;
        }
      `}</style>
    </section>
  );
};
