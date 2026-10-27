/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RouterProvider, useRouter } from './context/RouterContext';
import { CartProvider } from './context/CartContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { FloatingCartBar } from './components/common/FloatingCartBar';
import { CartConflictModal } from './components/common/CartConflictModal';
import { DistanceWarningModal } from './components/common/DistanceWarningModal';
import { QRScanModal } from './components/common/QRScanModal';
import { GlobalLoadingSkeleton } from './components/common/GlobalLoadingSkeleton';
import { AccessibilityModal } from './components/common/AccessibilityModal';
import { ActiveOrderBanner } from './components/common/ActiveOrderBanner';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Primary Eager Customer View (Instant First Contentful Paint)
import { HomeView } from './views/HomeView';

// On-Demand Lazy-Loaded Customer Views (Progressive Loading & Route Splitting)
const SearchView = React.lazy(() => import('./views/SearchView').then(m => ({ default: m.SearchView })));
const ShopsView = React.lazy(() => import('./views/ShopsView').then(m => ({ default: m.ShopsView })));
const ShopDetailView = React.lazy(() => import('./views/ShopDetailView').then(m => ({ default: m.ShopDetailView })));
const CartView = React.lazy(() => import('./views/CartView').then(m => ({ default: m.CartView })));
const CheckoutView = React.lazy(() => import('./views/CheckoutView').then(m => ({ default: m.CheckoutView })));
const OrderTrackerView = React.lazy(() => import('./views/OrderTrackerView').then(m => ({ default: m.OrderTrackerView })));
const OrdersHistoryView = React.lazy(() => import('./views/OrdersHistoryView').then(m => ({ default: m.OrdersHistoryView })));
const SavedShopsView = React.lazy(() => import('./views/SavedShopsView').then(m => ({ default: m.SavedShopsView })));
const ProfileView = React.lazy(() => import('./views/ProfileView').then(m => ({ default: m.ProfileView })));
const LoginView = React.lazy(() => import('./views/LoginView').then(m => ({ default: m.LoginView })));
const RegisterView = React.lazy(() => import('./views/RegisterView').then(m => ({ default: m.RegisterView })));
const CompleteProfileView = React.lazy(() => import('./views/CompleteProfileView').then(m => ({ default: m.CompleteProfileView })));
const PrivacyPolicyView = React.lazy(() => import('./views/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView })));
const TermsOfServiceView = React.lazy(() => import('./views/TermsOfServiceView').then(m => ({ default: m.TermsOfServiceView })));
const RefundPolicyView = React.lazy(() => import('./views/RefundPolicyView').then(m => ({ default: m.RefundPolicyView })));
const NotFoundView = React.lazy(() => import('./views/NotFoundView').then(m => ({ default: m.NotFoundView })));

const RouteSuspenseFallback: React.FC = () => (
  <div className="py-12 px-4 max-w-lg mx-auto text-center space-y-3 animate-in fade-in duration-150">
    <div className="w-9 h-9 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
    <p className="text-xs font-semibold text-slate-500">Loading screen...</p>
  </div>
);

import { Footer } from './components/common/Footer';
import { firestoreSync } from './services/firestoreSyncService';

const AppContent: React.FC = () => {
  const { route } = useRouter();
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  React.useEffect(() => {
    // Subscribe to Supabase sync state (loading / active network fetches)
    const unsub = firestoreSync.subscribeSyncState((syncing) => {
      setIsSyncing(syncing);
    });

    // Run database initialization in background without blocking initial paint
    firestoreSync.initializeDatabase().catch((err) => {
      console.warn('[App] Background DB init:', err);
    });

    return () => unsub();
  }, []);

  // Dynamic SEO & Page Titles based on Active Route
  React.useEffect(() => {
    if (!route) return;
    const titles: Record<string, string> = {
      home: 'FoodFax - Order Fresh Street Food & Meals in Vasai-Virar',
      search: 'Search Street Food Dishes & Stalls | FoodFax',
      shops: 'Local Street Food Stalls & Tapris in Vasai-Virar | FoodFax',
      'shop-detail': 'Stall Menu & Live Token Queue | FoodFax',
      cart: 'Your Order Cart | FoodFax',
      checkout: 'Checkout & UPI Payment | FoodFax',
      'order-tracker': 'Live Kitchen Token Queue Tracker | FoodFax',
      'order-history': 'My Past Orders & Receipts | FoodFax',
      saved: 'Saved Street Food Stalls | FoodFax',
      profile: 'Customer Profile & Settings | FoodFax',
      login: 'Sign In to FoodFax',
      register: 'Create FoodFax Account',
      'complete-profile': 'Complete Your Profile | FoodFax',
      privacy: 'Privacy Policy | FoodFax - Street Food in Vasai-Virar',
      terms: 'Terms of Service | FoodFax - Street Food in Vasai-Virar',
      refunds: 'Refund & Cancellation Policy | FoodFax',
      'not-found': 'Page Not Found (404) | FoodFax',
    };
    if (titles[route.name]) {
      document.title = titles[route.name];
    }
  }, [route]);

  // Render customer views
  const renderCustomerView = () => {
    const current = route || { name: 'home', path: '/', params: {} };
    switch (current.name) {
      case 'home':
        return <HomeView onOpenQRScanner={() => setIsQRScannerOpen(true)} />;
      case 'search':
        return <SearchView />;
      case 'shops':
        return <ShopsView />;
      case 'shop-detail':
        return <ShopDetailView shopId={current.params.shopId || 'sharma-vada-pav'} />;
      case 'cart':
        return <CartView />;
      case 'checkout':
        return <CheckoutView />;
      case 'order-tracker':
        return <OrderTrackerView orderId={current.params.orderId} />;
      case 'order-history':
        return <OrdersHistoryView />;
      case 'saved':
        return <SavedShopsView />;
      case 'profile':
        return (
          <ProtectedRoute redirectTo="/profile">
            <ProfileView onOpenQRScanner={() => setIsQRScannerOpen(true)} />
          </ProtectedRoute>
        );
      case 'login':
        return <LoginView />;
      case 'register':
        return <RegisterView />;
      case 'complete-profile':
        return <CompleteProfileView />;
      case 'privacy':
        return <PrivacyPolicyView />;
      case 'terms':
        return <TermsOfServiceView />;
      case 'refunds':
        return <RefundPolicyView />;
      case 'not-found':
        return <NotFoundView />;
      default:
        return <NotFoundView />;
    }
  };

  const isAuthPage =
    route &&
    (route.name === 'login' ||
      route.name === 'register' ||
      route.name === 'complete-profile');

  return (
    <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden bg-[#F8F9FA] text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white relative">
      {/* Accessible Skip Navigation Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-600 focus:text-white focus:font-bold focus:rounded-xl focus:shadow-xl focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Global Supabase Loading Skeletons */}
      <GlobalLoadingSkeleton isSyncing={isSyncing} isInitialLoad={isInitialLoading} />

      {/* Top Header */}
      <Header onOpenQRScanner={() => setIsQRScannerOpen(true)} />

      {/* Live Sticky Active Order Tracker Banner (Real-time token calls across all pages) */}
      <ActiveOrderBanner />

      {/* Main Page Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-7xl mx-auto focus:outline-none overflow-x-hidden min-w-0">
        <React.Suspense fallback={<RouteSuspenseFallback />}>
          {renderCustomerView()}
        </React.Suspense>
      </main>

      {/* Footer with Legal Policies & Compliance */}
      <Footer />

      {/* Floating Quick Cart Bar (Hidden in Cart, Checkout, and Auth Views) */}
      {!isAuthPage && <FloatingCartBar />}

      {/* Persistent Bottom Mobile Navigation Bar (Hidden in Auth Views) */}
      {!isAuthPage && <BottomNav />}

      {/* Accessibility Preferences Modal */}
      <AccessibilityModal />

      {/* Single-Shop Cart Conflict Prevention Modal */}
      <CartConflictModal />

      {/* Far Distance Warning & 4km Bike/Car Pickup Modal */}
      <DistanceWarningModal />

      {/* QR Scanner & Simulation Modal */}
      <QRScanModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
      />
    </div>
  );
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FoodFax ErrorBoundary] caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-800">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-slate-900">Application Error</h2>
            <p className="text-xs text-slate-600 font-mono bg-slate-100 p-3 rounded-xl overflow-x-auto text-left whitespace-pre-wrap">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors w-full shadow-xs"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export default function App() {
  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <AuthProvider>
          <RouterProvider>
            <CartProvider>
              <AppContent />
              <Analytics />
              <SpeedInsights />
            </CartProvider>
          </RouterProvider>
        </AuthProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}

