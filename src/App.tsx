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
import { QRScanModal } from './components/common/QRScanModal';
import { GlobalLoadingSkeleton } from './components/common/GlobalLoadingSkeleton';
import { AccessibilityModal } from './components/common/AccessibilityModal';
import { ActiveOrderBanner } from './components/common/ActiveOrderBanner';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Customer Views
import { HomeView } from './views/HomeView';
import { SearchView } from './views/SearchView';
import { ShopsView } from './views/ShopsView';
import { ShopDetailView } from './views/ShopDetailView';
import { CartView } from './views/CartView';
import { CheckoutView } from './views/CheckoutView';
import { OrderTrackerView } from './views/OrderTrackerView';
import { OrdersHistoryView } from './views/OrdersHistoryView';
import { SavedShopsView } from './views/SavedShopsView';
import { ProfileView } from './views/ProfileView';
import { LoginView } from './views/LoginView';
import { RegisterView } from './views/RegisterView';
import { CompleteProfileView } from './views/CompleteProfileView';
import { SetupShopView } from './views/business/SetupShopView';

// Business Ecosystem Views
import { BusinessDashboardView } from './views/business/BusinessDashboardView';
import { BusinessOrdersView } from './views/business/BusinessOrdersView';
import { BusinessOrderDetailView } from './views/business/BusinessOrderDetailView';
import { BusinessMenuView } from './views/business/BusinessMenuView';
import { BusinessItemFormView } from './views/business/BusinessItemFormView';
import { BusinessAvailabilityView } from './views/business/BusinessAvailabilityView';
import { BusinessShopProfileView } from './views/business/BusinessShopProfileView';
import { BusinessQRView } from './views/business/BusinessQRView';
import { BusinessSalesView } from './views/business/BusinessSalesView';
import { BusinessNotificationsView } from './views/business/BusinessNotificationsView';
import { BusinessSettingsView } from './views/business/BusinessSettingsView';
import { firestoreSync } from './services/firestoreSyncService';

const AppContent: React.FC = () => {
  const { route } = useRouter();
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  React.useEffect(() => {
    // Subscribe to Firestore active network sync / fetch states
    const unsub = firestoreSync.subscribeSyncState((syncing) => {
      setIsSyncing(syncing);
    });

    firestoreSync.initializeDatabase().finally(() => {
      // Allow slight breather for perceived smooth transition
      setTimeout(() => setIsInitialLoading(false), 500);
    });

    return () => unsub();
  }, []);

  const isBusinessRoute = route && route.name.startsWith('business-');

  // If inside business dashboard ecosystem, render appropriate business view directly
  if (isBusinessRoute) {
    let businessView: React.ReactNode;
    switch (route.name) {
      case 'business-dashboard':
        businessView = <BusinessDashboardView />;
        break;
      case 'business-orders':
      case 'business-history':
        businessView = <BusinessOrdersView />;
        break;
      case 'business-order-detail':
        businessView = <BusinessOrderDetailView />;
        break;
      case 'business-menu':
        businessView = <BusinessMenuView />;
        break;
      case 'business-menu-new':
      case 'business-menu-edit':
        businessView = <BusinessItemFormView />;
        break;
      case 'business-availability':
        businessView = <BusinessAvailabilityView />;
        break;
      case 'business-shop':
        businessView = <BusinessShopProfileView />;
        break;
      case 'business-qr':
        businessView = <BusinessQRView />;
        break;
      case 'business-sales':
        businessView = <BusinessSalesView />;
        break;
      case 'business-notifications':
        businessView = <BusinessNotificationsView />;
        break;
      case 'business-settings':
        businessView = <BusinessSettingsView />;
        break;
      default:
        businessView = <BusinessDashboardView />;
        break;
    }

    return (
      <>
        <GlobalLoadingSkeleton isSyncing={isSyncing} isInitialLoad={false} />
        <ProtectedRoute requiredRole="owner" redirectTo="/business">
          {businessView}
        </ProtectedRoute>
      </>
    );
  }

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
        return <OrderTrackerView orderId={current.params.orderId || 'order-101'} />;
      case 'order-history':
        return (
          <ProtectedRoute requiredRole="customer" redirectTo="/orders">
            <OrdersHistoryView />
          </ProtectedRoute>
        );
      case 'saved':
        return (
          <ProtectedRoute requiredRole="customer" redirectTo="/saved">
            <SavedShopsView />
          </ProtectedRoute>
        );
      case 'profile':
        return (
          <ProtectedRoute requiredRole="customer" redirectTo="/profile">
            <ProfileView onOpenQRScanner={() => setIsQRScannerOpen(true)} />
          </ProtectedRoute>
        );
      case 'login':
        return <LoginView />;
      case 'register':
        return <RegisterView />;
      case 'complete-profile':
        return <CompleteProfileView />;
      case 'setup-shop':
        return <SetupShopView />;
      default:
        return <HomeView onOpenQRScanner={() => setIsQRScannerOpen(true)} />;
    }
  };

  const isAuthPage =
    route &&
    (route.name === 'login' ||
      route.name === 'register' ||
      route.name === 'complete-profile' ||
      route.name === 'setup-shop');

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white relative">
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
      {!isBusinessRoute && <ActiveOrderBanner />}

      {/* Main Page Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-7xl mx-auto focus:outline-none">
        {renderCustomerView()}
      </main>

      {/* Floating Quick Cart Bar (Hidden in Cart, Checkout, and Auth Views) */}
      {!isAuthPage && <FloatingCartBar />}

      {/* Persistent Bottom Mobile Navigation Bar (Hidden in Auth Views) */}
      {!isAuthPage && <BottomNav />}

      {/* Accessibility Preferences Modal */}
      <AccessibilityModal />

      {/* Single-Shop Cart Conflict Prevention Modal */}
      <CartConflictModal />

      {/* QR Scanner & Simulation Modal */}
      <QRScanModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AccessibilityProvider>
      <AuthProvider>
        <RouterProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </RouterProvider>
      </AuthProvider>
    </AccessibilityProvider>
  );
}

