import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { orderService } from '../../services/orderService';
import { 
  Home, 
  Tag, 
  ReceiptText, 
  Heart,
  Sparkles
} from 'lucide-react';

interface BottomNavProps {
  onOpenQRScanner?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenQRScanner }) => {
  const { route, navigate } = useRouter();
  const { currentUser } = useAuth();
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [isVegMode, setIsVegMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('foodfax_veg_mode_active') === 'true';
    } catch {
      return false;
    }
  });

  // Check active orders for the live notification dot
  useEffect(() => {
    if (!currentUser) {
      setHasActiveOrder(false);
      return;
    }

    const checkActiveOrders = async () => {
      const orders = await orderService.getCustomerOrders(currentUser?.id);
      const active = orders.some(
        (o) =>
          o.orderStatus === 'PENDING' ||
          o.orderStatus === 'ACCEPTED' ||
          o.orderStatus === 'PREPARING' ||
          o.orderStatus === 'READY'
      );
      setHasActiveOrder(active);
    };

    checkActiveOrders();
    const interval = setInterval(checkActiveOrders, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // Sync veg mode from custom events (if toggled on HomeView)
  useEffect(() => {
    const handleVegToggled = (e: any) => {
      if (typeof e.detail?.isVeg === 'boolean') {
        setIsVegMode(e.detail.isVeg);
      }
    };
    window.addEventListener('foodfax:veg-mode-changed', handleVegToggled);
    return () => window.removeEventListener('foodfax:veg-mode-changed', handleVegToggled);
  }, []);

  const handleToggleVegMode = () => {
    const nextState = !isVegMode;
    setIsVegMode(nextState);
    try {
      localStorage.setItem('foodfax_veg_mode_active', String(nextState));
    } catch {}
    window.dispatchEvent(
      new CustomEvent('foodfax:veg-mode-changed', { detail: { isVeg: nextState } })
    );

    // If on another route, navigate home to show filtered pure veg stalls
    if (route.name !== 'home' && route.name !== 'shops') {
      navigate('/');
    }
  };

  const handleActionPillClick = () => {
    if (onOpenQRScanner) {
      onOpenQRScanner();
    } else {
      window.dispatchEvent(new CustomEvent('foodfax:open-qr-scanner'));
    }
  };

  const isHomeActive = route.name === 'home' || route.name === 'shops';
  const isOrdersActive = route.name === 'order-history' || route.name === 'order-tracker';
  const isSearchActive = route.name === 'search';

  return (
    <nav
      aria-label="Floating Mobile Navigation"
      className="md:hidden fixed bottom-3 sm:bottom-4 left-0 right-0 z-40 px-2.5 sm:px-4 pointer-events-none safe-area-pb"
    >
      <div className="w-full max-w-md mx-auto flex items-center justify-between gap-2 pointer-events-auto">
        
        {/* 1. LEFT MAIN FLOATING ISLAND (White Pill with Active Soft Tint & Gradient Action Button) */}
        <div className="flex-1 min-w-0 h-[50px] bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(15,23,42,0.15)] rounded-full px-2 flex items-center justify-between transition-all">
          
          {/* Tab 1: Home */}
          <button
            type="button"
            id="nav-home"
            onClick={() => navigate('/')}
            className={`px-3 py-1 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 shrink-0 ${
              isHomeActive
                ? 'bg-[#eaf7ee] text-[#1b7a42]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            aria-label="Home food stalls"
          >
            <Home className={`w-4.5 h-4.5 ${isHomeActive ? 'stroke-[2.4] text-[#1b7a42]' : 'stroke-[1.8]'}`} />
            <span className={`text-[10px] mt-0.5 leading-none ${isHomeActive ? 'font-bold' : 'font-medium'}`}>
              Home
            </span>
          </button>

          {/* Tab 2: Under ₹99 / Budget */}
          <button
            type="button"
            id="nav-search"
            onClick={() => navigate('/search')}
            className={`px-2 py-1 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 shrink-0 ${
              isSearchActive
                ? 'bg-orange-50 text-orange-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            aria-label="Search street food under ₹99"
          >
            <div className="relative">
              <Tag className={`w-4.5 h-4.5 ${isSearchActive ? 'stroke-[2.4] text-orange-600' : 'stroke-[1.8]'}`} />
              <span className="absolute -top-1 -right-1 text-[8px] font-black leading-none text-orange-600">₹</span>
            </div>
            <span className={`text-[10px] mt-0.5 leading-none ${isSearchActive ? 'font-bold' : 'font-medium'}`}>
              Under ₹99
            </span>
          </button>

          {/* Tab 3: Orders (Dining & Live Tokens) */}
          <button
            type="button"
            id="nav-orders"
            onClick={() => navigate('/orders')}
            className={`relative px-2 py-1 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 shrink-0 ${
              isOrdersActive
                ? 'bg-orange-50 text-orange-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            aria-label="My orders and live queue tokens"
          >
            <div className="relative">
              <ReceiptText className={`w-4.5 h-4.5 ${isOrdersActive ? 'stroke-[2.4] text-orange-600' : 'stroke-[1.8]'}`} />
              {hasActiveOrder && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <span className={`text-[10px] mt-0.5 leading-none ${isOrdersActive ? 'font-bold' : 'font-medium'}`}>
              Orders
            </span>
          </button>

          {/* Tab 4: Glowing Purple-Pink Gradient Sparkle Pill (Zomato AI / Counter Scan) */}
          <button
            type="button"
            id="nav-action-sparkle"
            onClick={handleActionPillClick}
            className="relative w-12 sm:w-14 h-9 sm:h-9.5 rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#d946ef] to-[#f43f5e] text-white flex items-center justify-center shadow-md shadow-fuchsia-500/25 active:scale-95 transition-all group overflow-hidden shrink-0"
            title="Scan Stall Counter QR Code"
            aria-label="Scan Counter QR code"
          >
            {/* Subtle ambient highlight sheen */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/25 pointer-events-none" />

            {/* Authentic 12-dot diamond sparkle pattern from screenshot */}
            <svg 
              width="19" 
              height="19" 
              viewBox="0 0 24 24" 
              fill="currentColor"
              className="group-hover:scale-110 transition-transform duration-300 drop-shadow-xs"
            >
              {/* Center dot */}
              <circle cx="12" cy="12" r="1.3" />
              {/* Inner ring */}
              <circle cx="12" cy="9.2" r="1.1" />
              <circle cx="12" cy="14.8" r="1.1" />
              <circle cx="9.2" cy="12" r="1.1" />
              <circle cx="14.8" cy="12" r="1.1" />
              {/* Outer tips */}
              <circle cx="12" cy="6.5" r="0.9" />
              <circle cx="12" cy="17.5" r="0.9" />
              <circle cx="6.5" cy="12" r="0.9" />
              <circle cx="17.5" cy="12" r="0.9" />
              {/* Diagonals */}
              <circle cx="9.8" cy="9.8" r="0.8" />
              <circle cx="14.2" cy="9.8" r="0.8" />
              <circle cx="9.8" cy="14.2" r="0.8" />
              <circle cx="14.2" cy="14.2" r="0.8" />
            </svg>
          </button>

        </div>

        {/* 2. RIGHT COMPANION ISLAND: DARK GREEN "VEG MODE" CAPSULE */}
        <button
          type="button"
          id="nav-veg-mode-toggle"
          onClick={handleToggleVegMode}
          aria-pressed={isVegMode}
          className={`h-[50px] shrink-0 rounded-full px-3.5 sm:px-4.5 flex items-center justify-center gap-1.5 shadow-[0_10px_30px_-4px_rgba(15,23,42,0.2)] transition-all active:scale-95 cursor-pointer border ${
            isVegMode
              ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.45)]'
              : 'bg-[#183017] text-[#86efac] border-[#294c25] hover:bg-[#203c1f]'
          }`}
          title="Toggle Pure Veg Stalls & Food"
          aria-label="Toggle Pure Veg stalls mode"
        >
          {/* Heart with Sparkle Icon (Matching screenshot icon) */}
          <div className="relative flex items-center justify-center">
            <Heart className={`w-4 h-4 ${isVegMode ? 'fill-white stroke-white' : 'stroke-[#86efac] stroke-[2]'}`} />
            <Sparkles className={`w-2.5 h-2.5 absolute -top-1 -right-1 ${isVegMode ? 'text-amber-300 fill-amber-300' : 'text-[#86efac]'}`} />
          </div>

          <span className="text-[11px] font-extrabold tracking-tight whitespace-nowrap">
            {isVegMode ? 'Veg ON' : 'Veg Mode'}
          </span>
        </button>

      </div>
    </nav>
  );
};
