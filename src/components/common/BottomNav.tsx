import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { orderService } from '../../services/orderService';
import { 
  Home, 
  Search, 
  ReceiptText, 
  Heart, 
  User 
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { route, navigate } = useRouter();
  const { currentUser } = useAuth();
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  useEffect(() => {
    // Only poll active customer orders if logged-in
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-lg border-t border-slate-200/90 safe-area-pb shadow-lg"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto items-center px-1">
        {customerNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-1 transition-colors relative min-h-[48px] active:scale-95 touch-manipulation ${
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
              <span className="text-[10px] font-medium tracking-tight mt-0.5">{item.name}</span>
              {item.isActive && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-orange-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
