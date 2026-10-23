import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { 
  QrCode, 
  MapPin, 
  ShoppingBag, 
  Search, 
  ChevronRight, 
  ChevronDown,
  Heart, 
  LogIn, 
  User, 
  LogOut, 
  Receipt,
  UserPlus,
  Sliders
} from 'lucide-react';
import { DEFAULT_CUSTOMER_LOCATION } from '../../services/geoService';

interface HeaderProps {
  onOpenQRScanner: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQRScanner }) => {
  const { route, navigate } = useRouter();
  const { totalItems } = useCart();
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { openA11yModal, highContrast } = useAccessibility();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs safe-area-pt transition-colors"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              id="brand-home-link"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 rounded-xl"
              aria-label="FoodFax Home - Counter Orders"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-sm shadow-orange-500/25 group-hover:scale-105 transition-transform shrink-0">
                <span className="tracking-tighter">FF</span>
              </div>
              <div className="hidden xs:block min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base sm:text-xl tracking-tight text-slate-900 leading-none">
                    Food<span className="text-orange-600">Fax</span>
                  </span>
                  <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200/60">
                    Stalls
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block leading-tight font-medium mt-0.5">
                  Order Ahead & Live Tokens
                </p>
              </div>
            </button>
          </div>

          {/* Location Selector (Visible on both Mobile and Desktop) */}
          <button
            id="location-selector-btn"
            onClick={handleOpenLocationPicker}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 transition-colors text-xs font-semibold text-slate-800 border border-slate-200/80 focus-visible:ring-2 focus-visible:ring-orange-600 max-w-[150px] xs:max-w-[190px] sm:max-w-[240px] md:max-w-[280px] shrink truncate"
            title="Current Ordering Location (Tap to change)"
            aria-label="Change campus or food court ordering zone"
          >
            <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span className="truncate text-[11px] sm:text-xs">
              {activeLocation.area || activeLocation.city || 'Naigaon East'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {/* Desktop Centered Large Search Bar */}
          <div
            onClick={() => navigate('/search')}
            className="hidden lg:flex items-center flex-1 max-w-md mx-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200/90 text-slate-500 text-xs font-medium cursor-pointer transition-colors group"
          >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-orange-600 mr-2.5 shrink-0 transition-colors" />
            <span className="truncate text-slate-400 group-hover:text-slate-600">
              Search for food, shops or dishes...
            </span>
          </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {/* Quick Scan Shop QR */}
          <button
            id="scan-stall-qr-btn"
            onClick={onOpenQRScanner}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-orange-50 hover:bg-orange-100/80 active:scale-95 text-orange-700 border border-orange-200 text-xs font-bold transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-orange-600"
            title="Scan Shop or Table QR Code"
            aria-label="Scan stall or table QR code"
          >
            <QrCode className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span className="hidden sm:inline font-semibold">Scan Stall QR</span>
            <span className="sm:hidden font-semibold">Scan</span>
          </button>

          {/* Search Shortcut (Hidden on mobile because BottomNav already has a prominent Search tab) */}
          <button
            id="quick-search-btn"
            onClick={() => navigate('/search')}
            className={`hidden sm:flex p-2 rounded-xl border text-slate-600 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-orange-600 ${
              route.name === 'search'
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            aria-label="Search food or shops (Alt + S)"
            title="Search dishes and stalls (Alt + S)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Accessibility Settings Shortcut */}
          <button
            id="quick-a11y-btn"
            onClick={openA11yModal}
            className="p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-orange-600"
            aria-label="Accessibility options, high contrast, and voice announcements (Alt + A)"
            title="Accessibility Preferences (Alt + A)"
          >
            <Sliders className="w-4 h-4 text-slate-700" />
          </button>

          {/* Saved Shops (For authenticated Customers or quick access) */}
          <button
            id="quick-saved-btn"
            onClick={() => navigate('/saved')}
            className={`hidden sm:flex p-2 rounded-xl border text-slate-600 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-orange-600 ${
              route.name === 'saved'
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            aria-label="Saved stalls"
            title="Saved Stalls"
          >
            <Heart className="w-4 h-4" />
          </button>

          {/* Cart Button */}
          <button
            id="quick-cart-btn"
            onClick={() => navigate('/cart')}
            className="relative p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 transition-all focus-visible:ring-2 focus-visible:ring-orange-600"
            aria-label={`Shopping Cart, ${totalItems} items`}
            title="View Cart"
          >
            <ShoppingBag className="w-4 h-4" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-orange-600 text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                {totalItems}
              </span>
            )}
          </button>

          {/* Dynamic Auth & Role-Based Navigation Area */}
          {!isAuthenticated || !currentUser ? (
            // UNAUTHENTICATED STATE: Login & Register
            <div className="flex items-center gap-1.5">
              <button
                id="header-login-btn"
                onClick={() => navigate('/login')}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden xs:inline">Sign In</span>
              </button>

              <button
                id="header-register-btn"
                onClick={() => navigate('/register')}
                className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs shadow-orange-500/20 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          ) : (
            // CUSTOMER AUTHENTICATED STATE: Profile Dropdown
            <div className="relative" ref={dropdownRef}>
              <button
                id="header-user-menu-btn"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {currentUser.photoUrl && currentUser.photoUrl.trim() !== '' ? (
                    <img src={currentUser.photoUrl.trim()} alt={currentUser.fullName} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.fullName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-none truncate max-w-[100px]">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">Customer</div>
                </div>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {currentUser.phone || currentUser.email}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/profile');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/orders');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    <span>Order Tokens & History</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/saved');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Saved Stalls</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
    {/* Spacer so page content starts cleanly below the fixed header */}
    <div className="h-15 sm:h-16 w-full shrink-0 pointer-events-none" aria-hidden="true" />
  </>
  );
};
