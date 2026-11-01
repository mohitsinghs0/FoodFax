import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { 
  QrCode, 
  MapPin, 
  ShoppingBag, 
  ChevronDown,
  Heart, 
  LogIn, 
  User, 
  LogOut, 
  Receipt,
  Sliders
} from 'lucide-react';
import { DEFAULT_CUSTOMER_LOCATION } from '../../services/geoService';

interface HeaderProps {
  onOpenQRScanner?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { route, navigate } = useRouter();
  const { totalItems } = useCart();
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { openA11yModal } = useAccessibility();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track scroll position for transparent -> glass header transition on Home
  const [isScrolled, setIsScrolled] = useState(false);
  const [heroTheme, setHeroTheme] = useState<{ isDark: boolean; textColor: string; subtextColor: string }>({
    isDark: true,
    textColor: 'text-white',
    subtextColor: 'text-white/80',
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for dynamic hero slide theme changes from HomeView
  useEffect(() => {
    const handleHeroTheme = (e: any) => {
      if (e.detail) {
        setHeroTheme(e.detail);
      }
    };
    window.addEventListener('foodfax:hero-theme-changed', handleHeroTheme);
    return () => window.removeEventListener('foodfax:hero-theme-changed', handleHeroTheme);
  }, []);

  // Active location synchronized with localStorage / HomeView
  const [activeLocation, setActiveLocation] = useState<{ area: string; city: string }>(() => {
    try {
      const saved = localStorage.getItem('foodfax_active_location');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.area || p.city) return { area: p.area || '', city: p.city || '' };
      }
    } catch {}
    return {
      area: currentUser?.area || DEFAULT_CUSTOMER_LOCATION.area,
      city: currentUser?.city || DEFAULT_CUSTOMER_LOCATION.city,
    };
  });

  useEffect(() => {
    const handleLocChanged = (e: any) => {
      if (e.detail) {
        setActiveLocation({ area: e.detail.area || '', city: e.detail.city || '' });
      }
    };
    window.addEventListener('foodfax:location-changed', handleLocChanged);
    return () => window.removeEventListener('foodfax:location-changed', handleLocChanged);
  }, []);

  const handleOpenLocationPicker = () => {
    if (route.name === 'home') {
      window.dispatchEvent(new CustomEvent('foodfax:open-location-modal'));
    } else {
      navigate('/');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('foodfax:open-location-modal'));
      }, 100);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    navigate('/');
  };

  const userInitial = currentUser?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'M';
  const isHome = route.name === 'home';
  const isTransparent = isHome && !isScrolled;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 safe-area-pt transition-all duration-300 ${
          isTransparent
            ? 'bg-transparent border-b border-transparent shadow-none'
            : 'bg-white/95 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between gap-3">
          
          {/* LEFT: ZOMATO-STYLE LOCATION WITH TITLE & SUBTITLE */}
          <button
            id="location-selector-btn"
            onClick={handleOpenLocationPicker}
            className="flex items-start gap-2 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl max-w-[210px] xs:max-w-[260px] sm:max-w-md shrink"
            title="Change delivery or ordering area"
            aria-label="Change location"
          >
            <div className={`mt-0.5 transition-colors shrink-0 ${
              isTransparent
                ? (heroTheme.isDark ? 'text-white' : 'text-amber-950')
                : 'text-slate-900 group-hover:text-orange-600'
            }`}>
              <MapPin className="w-5 h-5 fill-current/15 stroke-[2.2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className={`font-black text-base sm:text-lg leading-none tracking-tight transition-colors truncate ${
                  isTransparent
                    ? (heroTheme.isDark ? 'text-white' : 'text-amber-950')
                    : 'text-slate-900 group-hover:text-orange-600'
                }`}>
                  {activeLocation.area || 'Home'}
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-colors ${
                  isTransparent
                    ? (heroTheme.isDark ? 'text-white/80' : 'text-amber-900/80')
                    : 'text-slate-600 group-hover:text-orange-600'
                }`} />
              </div>
              <p className={`text-[11px] sm:text-xs font-medium truncate mt-0.5 leading-tight transition-colors ${
                isTransparent
                  ? (heroTheme.isDark ? 'text-white/75' : 'text-amber-900/70')
                  : 'text-slate-500'
              }`}>
                {activeLocation.city ? `${activeLocation.area || 'Campus'}, ${activeLocation.city}` : 'Tap to set food stall zone...'}
              </p>
            </div>
          </button>

          {/* RIGHT: CONTROLS (Circle Cart + Circle Avatar) */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            
            {/* 1. Circular Cart / Wallet Button */}
            <button
              id="quick-cart-btn"
              onClick={() => navigate('/cart')}
              className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-2xs active:scale-95 ${
                isTransparent
                  ? (heroTheme.isDark
                      ? 'bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-xs'
                      : 'bg-black/10 hover:bg-black/15 text-amber-950 border border-amber-950/20 backdrop-blur-xs')
                  : 'border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-800'
              }`}
              aria-label={`Shopping Cart, ${totalItems} items`}
              title="View Cart"
            >
              <ShoppingBag className="w-4.5 h-4.5 stroke-[1.8]" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                  {totalItems}
                </span>
              )}
            </button>

            {/* 2. Circular User Avatar Button (matching 'M' avatar) */}
            {!isAuthenticated || !currentUser ? (
              <button
                id="header-login-btn"
                onClick={() => navigate('/login')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs active:scale-95 ${
                  isTransparent
                    ? (heroTheme.isDark
                        ? 'bg-white text-slate-900 hover:bg-white/90 shadow-md'
                        : 'bg-amber-950 text-white hover:bg-amber-900 shadow-md')
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  id="header-user-menu-btn"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm sm:text-base shadow-2xs active:scale-95 transition-all ${
                    isTransparent
                      ? 'border-2 border-white/60 bg-blue-500/90 text-white shadow-md'
                      : 'border border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                  aria-label="User account menu"
                >
                  {currentUser.photoUrl && currentUser.photoUrl.trim() !== '' ? (
                    <img src={currentUser.photoUrl.trim()} alt={currentUser.fullName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-float p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {currentUser.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {currentUser.phone || currentUser.email}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/orders');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                    >
                      <Receipt className="w-4 h-4 text-slate-400" />
                      <span>Order Tokens & History</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/saved');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                    >
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span>Saved Stalls</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        openA11yModal();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                    >
                      <Sliders className="w-4 h-4 text-slate-400" />
                      <span>Accessibility Settings</span>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-rose-600 hover:bg-rose-50/80 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Spacer so page content starts cleanly below the fixed header on non-home screens */}
      {!isHome && (
        <div className="h-16 w-full shrink-0 pointer-events-none" aria-hidden="true" />
      )}
    </>
  );
};
