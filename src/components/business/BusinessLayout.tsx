import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { 
  Store, 
  ShoppingBag, 
  UtensilsCrossed, 
  TrendingUp, 
  MoreHorizontal, 
  Bell, 
  Volume2, 
  VolumeX, 
  Zap, 
  QrCode, 
  Settings, 
  Sparkles, 
  Mic, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  UserCheck, 
  ArrowLeftRight, 
  ChevronRight,
  Clock,
  Check,
  X,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { shopService } from '../../services/shopService';
import { orderService } from '../../services/orderService';
import { menuService } from '../../services/menuService';
import { notificationService } from '../../services/notificationService';
import { orderRealtimeService } from '../../services/orderRealtimeService';
import { Shop, Order } from '../../types';

interface BusinessLayoutProps {
  children: React.ReactNode;
  activeTab?: 'dashboard' | 'orders' | 'menu' | 'sales' | 'more';
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export const BusinessLayout: React.FC<BusinessLayoutProps> = ({
  children,
  activeTab = 'dashboard',
  title,
  subtitle,
  showBackButton,
  onBack,
  actions,
}) => {
  const { route, navigate } = useRouter();
  const { currentUser, currentBusiness, activeShopId, logout } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const [shop, setShop] = useState<Shop | null>(null);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('foodflow_sound') !== 'false';
  });
  const [rushMode, setRushMode] = useState<boolean>(() => {
    return localStorage.getItem('foodflow_rush_mode') === 'true';
  });
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [pendingCloseWarning, setPendingCloseWarning] = useState(false);

  // Load shop and orders
  useEffect(() => {
    shopService.getShop(targetShopId).then((loadedShop) => {
      if (loadedShop) {
        setShop(loadedShop);
      } else if (currentBusiness) {
        setShop({
          id: currentBusiness.id,
          name: currentBusiness.name,
          slug: currentBusiness.id,
          tagline: 'Authentic Food Counter',
          description: '',
          stallType: currentBusiness.stallType || 'Thela / Food Stall',
          image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
          rating: 4.8,
          totalRatings: 120,
          location: {
            address: currentBusiness.address || 'Counter Stall',
            city: 'Mumbai',
          },
          openingHours: '08:00 AM - 10:00 PM',
          isOpen: true,
          contactPhone: currentBusiness.phone || '+91 98200 12345',
          isPopular: true,
          counterOrderEnabled: true,
        });
      }
    });

    const refreshCounts = async () => {
      const active = await orderService.getActiveOrders(targetShopId);
      setActiveOrdersCount(active.length);
      const notifs = await notificationService.getNotifications(targetShopId);
      setUnreadNotifsCount(notifs.filter((n) => !n.isRead).length);
    };

    refreshCounts();

    const unsubOrders = orderRealtimeService.subscribeToShop(targetShopId, (orders) => {
      const active = orders.filter(
        (o) =>
          o.orderStatus === 'PENDING' ||
          o.orderStatus === 'ACCEPTED' ||
          o.orderStatus === 'PREPARING' ||
          o.orderStatus === 'READY'
      );
      setActiveOrdersCount(active.length);
    });

    const unsubShop = shopService.subscribeToShop(targetShopId, (s) => {
      if (s) setShop(s);
    });

    return () => {
      unsubOrders();
      unsubShop();
    };
  }, [targetShopId, currentBusiness]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('foodflow_sound', String(next));
    if (next) {
      notificationService.playReadyChime();
    }
  };

  const toggleRushMode = () => {
    const next = !rushMode;
    setRushMode(next);
    localStorage.setItem('foodflow_rush_mode', String(next));
    if (next) {
      navigate('/business/orders?mode=rush');
    }
  };

  const handleShopStatusToggle = async () => {
    if (!shop) return;
    if (shop.isOpen && activeOrdersCount > 0) {
      setPendingCloseWarning(true);
      setIsStatusModalOpen(true);
    } else {
      const updated = await shopService.updateShopStatus(shop.id, !shop.isOpen);
      if (updated) setShop(updated);
    }
  };

  const confirmCloseShop = async () => {
    if (!shop) return;
    const updated = await shopService.updateShopStatus(shop.id, false);
    if (updated) setShop(updated);
    setIsStatusModalOpen(false);
    setPendingCloseWarning(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row">
      {/* Desktop Sidebar (visible on md: screens and above) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen z-20">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              F
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-slate-900">FoodFlow</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                  Partner
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[140px]">
                {currentBusiness?.name || shop?.name || 'My Food Stall'}
              </p>
            </div>
          </div>
        </div>

        {/* Shop Live Status Strip */}
        <div className="p-4 mx-3 my-2 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${shop?.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {shop?.isOpen ? 'Stall Open' : 'Stall Closed'}
              </span>
            </div>
            <button
              onClick={handleShopStatusToggle}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                shop?.isOpen 
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {shop?.isOpen ? 'Close' : 'Open'}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Andheri W Metro</span>
            <span>{shop?.isOpen ? 'Accepting Orders' : 'Offline'}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <button
            onClick={() => navigate('/business')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-dashboard'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => navigate('/business/orders')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-orders' || route.name === 'business-order-detail'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>Orders</span>
            </div>
            {activeOrdersCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500 text-white">
                {activeOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/business/menu')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-menu' || route.name === 'business-menu-new' || route.name === 'business-menu-edit'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 shrink-0" />
            <span>Menu Items</span>
          </button>

          <button
            onClick={() => navigate('/business/availability')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-availability'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Quick Availability</span>
          </button>

          <button
            onClick={() => navigate('/business/sales')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-sales'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Sales & Cash</span>
          </button>

          <button
            onClick={() => navigate('/business/qr')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-qr'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span>Shop QR Code</span>
          </button>

          <div className="pt-3 pb-1">
            <p className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Settings & Tools</p>
          </div>

          <button
            onClick={() => navigate('/business/notifications')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-notifications'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 shrink-0" />
              <span>Alerts</span>
            </div>
            {unreadNotifsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-orange-500" />
            )}
          </button>

          <button
            onClick={() => navigate('/business/shop')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-shop'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>Shop Profile</span>
          </button>

          <button
            onClick={() => navigate('/business/settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              route.name === 'business-settings'
                ? 'bg-orange-50 text-orange-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Preferences</span>
          </button>
        </nav>

        {/* Mode Switcher & Quick Assistant Button */}
        <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-xs rounded-xl shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>FoodFlow Assistant</span>
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton ? (
              <button
                onClick={onBack || (() => navigate('/business'))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            ) : (
              <div className="md:hidden flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black text-sm">
                  F
                </div>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base md:text-lg text-slate-900 truncate">
                  {title || shop?.name || 'Sharma Vada Pav'}
                </h1>
                {/* Shop status badge on mobile */}
                <button
                  onClick={handleShopStatusToggle}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    shop?.isOpen 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                  title="Click to toggle shop Open/Close"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${shop?.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>{shop?.isOpen ? 'OPEN' : 'CLOSED'}</span>
                </button>
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Rush Mode toggle */}
            <button
              onClick={toggleRushMode}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                rushMode
                  ? 'bg-amber-500 text-slate-950 shadow-sm animate-pulse'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Rush mode: Big tokens, rapid counter execution"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">RUSH</span>
            </button>

            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                soundEnabled ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-slate-100'
              }`}
              title={soundEnabled ? 'Order sound alert ON' : 'Order sound alert OFF'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <button
              onClick={() => navigate('/business/notifications')}
              className="relative w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-600" />
              )}
            </button>

            {/* Customer view shortcut button on mobile */}
            <button
              onClick={() => navigate('/shop/sharma-vada-pav')}
              className="md:hidden flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
              title="Preview Customer App"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span className="text-[10px]">Customer</span>
            </button>

            {/* Custom page actions */}
            {actions}
          </div>
        </header>

        {/* Offline Banner if offline */}
        {!isOnline && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline Mode: Orders cached locally. Reconnecting...</span>
          </div>
        )}

        {/* Page Body */}
        <main className="flex-1 px-3 sm:px-6 py-4 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (visible on mobile screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => navigate('/business')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            route.name === 'business-dashboard' ? 'text-orange-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => navigate('/business/orders')}
          className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            route.name === 'business-orders' || route.name === 'business-order-detail'
              ? 'text-orange-600 font-bold'
              : 'text-slate-500'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 mb-0.5" />
            {activeOrdersCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeOrdersCount}
              </span>
            )}
          </div>
          <span>Orders</span>
        </button>

        <button
          onClick={() => navigate('/business/menu')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            route.name === 'business-menu' || route.name === 'business-menu-new' || route.name === 'business-menu-edit'
              ? 'text-orange-600 font-bold'
              : 'text-slate-500'
          }`}
        >
          <UtensilsCrossed className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>

        <button
          onClick={() => navigate('/business/sales')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            route.name === 'business-sales' ? 'text-orange-600 font-bold' : 'text-slate-500'
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span>Sales</span>
        </button>

        <button
          onClick={() => setIsMoreDrawerOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            isMoreDrawerOpen ? 'text-orange-600 font-bold' : 'text-slate-500'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer Modal */}
      {isMoreDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                  {shop?.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{shop?.name}</h3>
                  <p className="text-xs text-slate-500">Business Control Panel</p>
                </div>
              </div>
              <button
                onClick={() => setIsMoreDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  navigate('/business/availability');
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left border border-slate-100"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Availability</div>
                  <div className="text-[10px] text-slate-500">Today's items</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  navigate('/business/qr');
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left border border-slate-100"
              >
                <QrCode className="w-5 h-5 text-slate-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Shop QR</div>
                  <div className="text-[10px] text-slate-500">Counter QR code</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  navigate('/business/shop');
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left border border-slate-100"
              >
                <UserCheck className="w-5 h-5 text-slate-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Stall Profile</div>
                  <div className="text-[10px] text-slate-500">Info & UPI ID</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  navigate('/business/history');
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left border border-slate-100"
              >
                <Clock className="w-5 h-5 text-slate-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Order History</div>
                  <div className="text-[10px] text-slate-500">Past tokens</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  navigate('/business/settings');
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left border border-slate-100"
              >
                <Settings className="w-5 h-5 text-slate-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Settings</div>
                  <div className="text-[10px] text-slate-500">Sound & staff</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  setIsAiModalOpen(true);
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-left border border-orange-100"
              >
                <Sparkles className="w-5 h-5 text-orange-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-orange-950">AI Assistant</div>
                  <div className="text-[10px] text-orange-600">Quick commands</div>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={async () => {
                  setIsMoreDrawerOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out from Stall Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Shop Close with Active Orders */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Close Stall for Customers?</h3>
              <p className="text-xs text-slate-600">
                {pendingCloseWarning
                  ? `You still have ${activeOrdersCount} active orders in progress. Are you sure you want to stop accepting new orders?`
                  : 'Customers scanning the QR code will see that your stall is currently closed.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Keep Open
              </button>
              <button
                onClick={confirmCloseShop}
                className="py-2.5 px-4 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors shadow-xs"
              >
                Yes, Close Shop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Business Assistant Placeholder Modal (Sections 42 & 43) */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">FoodFlow Assistant</h3>
                  <p className="text-[11px] text-slate-500">AI stall operations assistant (Voice & Text)</p>
                </div>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-orange-50/70 border border-orange-100 rounded-xl text-slate-700 space-y-1.5">
                <div className="font-bold text-orange-950 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-orange-600" />
                  <span>Stall Assistant Ready</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Tap any suggested stall command below to test quick operation:
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-[11px] text-slate-500 uppercase tracking-wider">Suggested Actions</p>
                
                <button
                  onClick={async () => {
                    await menuService.updateItemAvailability('svp-7', false);
                    setIsAiModalOpen(false);
                    navigate('/business/availability');
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-slate-800">"Mark Cold Coffee unavailable"</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    setIsAiModalOpen(false);
                    navigate('/business/orders?filter=PENDING');
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-slate-800">"Show pending orders"</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    setIsAiModalOpen(false);
                    navigate('/business/sales');
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-slate-800">"How much did I sell today?"</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={async () => {
                    await orderRealtimeService.simulateIncomingOrder('sharma-vada-pav');
                    setIsAiModalOpen(false);
                    navigate('/business/orders');
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-slate-800">"Simulate a customer order"</span>
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Demo</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask something... e.g. 'Vada pav 25 rupees kar do'"
                  className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                />
                <button
                  className="absolute right-2 top-2 text-orange-600 hover:text-orange-700"
                  title="Voice command placeholder"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
