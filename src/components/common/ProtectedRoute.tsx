import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { UserRole } from '../../types';
import { ShieldAlert, ArrowLeft, Store, LogIn } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  redirectTo,
}) => {
  const { currentUser, isAuthenticated, isLoading, loginAsDemoOwner, logout } = useAuth();
  const { route, navigate } = useRouter();

  // Show subtle loading state while session is being verified from storage/remote
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Restoring FoodFlow session...</p>
      </div>
    );
  }

  // 1. Unauthenticated Check
  if (!isAuthenticated || !currentUser) {
    const targetRedirect = redirectTo || route.path || '/';
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-in fade-in duration-200">
        <div className="bg-white max-w-md w-full rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
            <LogIn className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Authentication Required
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Please sign in to your FoodFlow account to access this page.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(targetRedirect)}`)}
              className="w-full py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Sign In to Continue</span>
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Food Stalls</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Role-Based Access Control
  if (requiredRole && currentUser.role !== requiredRole) {
    // If a Customer attempts to open Owner routes (/business/*)
    if (requiredRole === 'owner') {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-3xl border border-rose-200/80 p-6 sm:p-8 shadow-sm space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider">
                Restricted Access
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight pt-1">
                Stall Owner Account Required
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                You are currently signed in as a <strong className="text-slate-800 font-semibold">Customer</strong> ({currentUser.fullName}). Only registered stall owners can access live counter orders, menu availability, and sales analytics.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
              >
                Return to Customer Ordering
              </button>

              <button
                onClick={async () => {
                  await loginAsDemoOwner();
                  navigate('/business');
                }}
                className="w-full py-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4 text-orange-600" />
                <span>Switch to Demo Stall Owner</span>
              </button>

              <button
                onClick={async () => {
                  await logout();
                  navigate('/login?redirect=/business');
                }}
                className="text-xs text-slate-400 hover:text-slate-600 underline font-medium pt-1 block mx-auto"
              >
                Sign out and use another account
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Role mismatch for other roles
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mb-2" />
        <h3 className="text-base font-bold text-slate-800">Access Restricted</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Your current account role does not have permission to view this section.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold"
        >
          Go to Home
        </button>
      </div>
    );
  }

  // Role matches and authenticated
  return <>{children}</>;
};
