import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { orderService } from '../../services/orderService';
import { 
  Home, 
  Search, 
  ReceiptText, 
  Heart, 
  User, 
  LayoutDashboard, 
  UtensilsCrossed, 
  TrendingUp, 
  MoreHorizontal 
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { route, navigate } = useRouter();
  const { currentUser } = useAuth();
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  useEffect(() => {
    // Only poll active customer orders if customer or unauthenticated
    if (currentUser?.role === 'owner') return;

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
  }, [currentUser?.id, currentUser?.role]);

  // If user is a Stall Owner, show Owner Quick Navigation
  if (currentUser?.role === 'owner') {
    const ownerNavItems = [
      {
        id: 'owner-nav-dashboard',
        name: 'Overview',
        icon: LayoutDashboard,
        path: '/business',
        isActive: route.name === 'business-dashboard',
      },
      {
        id: 'owner-nav-orders',
        name: 'Orders',
        icon: ReceiptText,
        path: '/business/orders',
        isActive: route.name === 'business-orders' || route.name === 'business-order-detail',
      },
      {
        id: 'owner-nav-menu',
        name: 'Menu',
        icon: UtensilsCrossed,
        path: '/business/menu',
        isActive: route.name === 'business-menu' || route.name === 'business-menu-new' || route.name === 'business-menu-edit',
      },
      {
        id: 'owner-nav-sales',
        name: 'Sales',
        icon: TrendingUp,
        path: '/business/sales',
        isActive: route.name === 'business-sales',
      },
      {
        id: 'owner-nav-more',
        name: 'Settings',
        icon: MoreHorizontal,
        path: '/business/settings',
        isActive: route.name === 'business-settings' || route.name === 'business-shop' || route.name === 'business-qr',
      },
    ];

    return (
      <nav
        aria-label="Owner Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-md border-t border-slate-800 text-white safe-area-pb shadow-lg"
      >
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          {ownerNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors relative ${
                  item.isActive
                    ? 'text-orange-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${item.isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[10px] tracking-tight">{item.name}</span>
                {item.isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Customer & Visitor Navigation Items
  const customerNavItems = [
    {
      id: 'nav-home',
      name: 'Home',
      icon: Home,
      path: '/',
      isActive: route.name === 'home' || route.name === 'shops',
    },
    {
      id: 'nav-search',
      name: 'Search',
      icon: Search,
      path: '/search',
      isActive: route.name === 'search',
    },
    {
      id: 'nav-orders',
      name: 'Orders',
      icon: ReceiptText,
      path: '/orders',
      isActive: route.name === 'order-history' || route.name === 'order-tracker',
      badge: hasActiveOrder,
    },
    {
      id: 'nav-saved',
      name: 'Saved',
      icon: Heart,
      path: '/saved',
      isActive: route.name === 'saved',
    },
    {
      id: 'nav-profile',
      name: 'Profile',
      icon: User,
      path: '/profile',
      isActive: route.name === 'profile',
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-pb"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {customerNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors relative ${
                item.isActive
                  ? 'text-orange-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-orange-600 animate-ping" />
                )}
                {item.badge && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-orange-600" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.name}</span>
              {item.isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
