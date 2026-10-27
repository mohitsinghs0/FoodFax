import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppRoute = 
  | 'home'
  | 'search'
  | 'shops'
  | 'shop-detail'
  | 'cart'
  | 'checkout'
  | 'order-tracker'
  | 'order-history'
  | 'saved'
  | 'profile'
  | 'login'
  | 'register'
  | 'complete-profile'
  | 'privacy'
  | 'terms'
  | 'refunds'
  | 'not-found';

export interface RouteState {
  name: AppRoute;
  path: string;
  params: Record<string, string>;
  searchQuery?: string;
}

interface RouterContextType {
  route: RouteState;
  currentRoute: RouteState;
  navigate: (path: string) => void;
  goBack: () => void;
  canGoBack: boolean;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function parsePath(pathname: string): RouteState {
  const [cleanPart, queryPart] = pathname.replace(/^#+/, '').split('?');
  const rawClean = cleanPart || '/';
  const clean = rawClean.startsWith('/') ? rawClean : `/${rawClean}`;
  
  const queryParams: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });
  }
  const params = { ...queryParams };
  
  // Guard against legacy business routes and stall setup in customer app
  if (clean.startsWith('/business') || clean === '/setup-shop') {
    return { name: 'home', path: '/', params: { ...params } };
  }

  // Customer Routes matching
  // Match /shop/:shopId
  const shopMatch = clean.match(/^\/shop\/([^/?#]+)/);
  if (shopMatch) {
    const rawId = decodeURIComponent(shopMatch[1]).trim().replace(/\/$/, '');
    return {
      name: 'shop-detail',
      path: clean,
      params: { ...params, shopId: rawId },
    };
  }

  // Match /order/:orderId, /orders/:orderId, /order-tracker/:orderId
  const orderMatch = clean.match(/^\/(?:orders?|order-tracker)\/([^/]+)/);
  if (orderMatch && orderMatch[1] !== '') {
    return {
      name: 'order-tracker',
      path: clean,
      params: { ...params, orderId: orderMatch[1] },
    };
  }

  if (clean === '/order-tracker') {
    return { name: 'order-tracker', path: '/order-tracker', params: { ...params } };
  }

  if (clean === '/orders') {
    return { name: 'order-history', path: '/orders', params: { ...params } };
  }

  if (clean === '/search') {
    return { name: 'search', path: '/search', params: { ...params } };
  }

  if (clean === '/shops') {
    return { name: 'shops', path: '/shops', params: { ...params } };
  }

  if (clean === '/cart') {
    return { name: 'cart', path: '/cart', params: { ...params } };
  }

  if (clean === '/checkout') {
    return { name: 'checkout', path: '/checkout', params: { ...params } };
  }

  if (clean === '/saved') {
    return { name: 'saved', path: '/saved', params: { ...params } };
  }

  if (clean === '/profile') {
    return { name: 'profile', path: '/profile', params: { ...params } };
  }

  if (clean === '/login') {
    return { name: 'login', path: '/login', params: { ...params } };
  }

  if (clean === '/register') {
    return { name: 'register', path: '/register', params: { ...params } };
  }

  if (clean === '/complete-profile') {
    return { name: 'complete-profile', path: '/complete-profile', params: { ...params } };
  }

  if (clean === '/privacy') {
    return { name: 'privacy', path: '/privacy', params: { ...params } };
  }

  if (clean === '/terms') {
    return { name: 'terms', path: '/terms', params: { ...params } };
  }

  if (clean === '/refunds') {
    return { name: 'refunds', path: '/refunds', params: { ...params } };
  }

  if (clean === '/' || clean === '') {
    return { name: 'home', path: '/', params: { ...params } };
  }

  return { name: 'not-found', path: clean, params: { ...params } };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (hash) return [hash];
      if (window.location.pathname && window.location.pathname !== '/') {
        return [`${window.location.pathname}${window.location.search}`];
      }
      return ['/'];
    }
    return ['/'];
  });

  const currentPath = history[history.length - 1] || '/';
  const route = parsePath(currentPath);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || '/';
      setHistory((prev) => {
        if (prev[prev.length - 1] !== hash) {
          return [...prev, hash];
        }
        return prev;
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
    setHistory((prev) => [...prev, path]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      const prevPath = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      window.location.hash = prevPath;
    } else {
      navigate('/');
    }
  }, [history, navigate]);

  return (
    <RouterContext.Provider
      value={{
        route,
        currentRoute: route,
        navigate,
        goBack,
        canGoBack: history.length > 1 && route.name !== 'home',
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
