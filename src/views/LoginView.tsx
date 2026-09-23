import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { 
  Store, 
  User, 
  Lock, 
  Mail, 
  Phone, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { route, navigate } = useRouter();
  const { login, loginAsDemoCustomer, loginAsDemoOwner, signInWithGoogle } = useAuth();
  const redirectPath = route.params?.redirect || '/';

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      setError('Please enter your email or phone number.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await login(emailOrPhone.trim(), password);
      if (loggedUser.role === 'owner') {
        navigate('/business');
      } else {
        navigate(redirectPath === '/business' ? '/' : redirectPath);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoCustomer = async () => {
    setLoading(true);
    try {
      await loginAsDemoCustomer();
      navigate(redirectPath === '/business' ? '/' : redirectPath);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoOwner = async () => {
    setLoading(true);
    try {
      await loginAsDemoOwner();
      navigate('/business');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Welcome to FoodFlow
        </h1>
        <p className="text-xs text-slate-500">
          Smart digital ordering and queue token system for food stalls & canteens
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleLogin} className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Email or Mobile Number
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="e.g. name@example.com or 9876543210"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Password (Optional for Demo)
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => navigate(`/register?redirect=${encodeURIComponent(redirectPath)}`)}
              className="font-bold text-orange-600 hover:underline"
            >
              Sign Up Free
            </button>
          </p>
        </div>
      </form>

      {/* Quick 1-Click Demo Accounts */}
      <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 text-center">
          Instant 1-Click Demo Access
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDemoCustomer}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 text-xs font-bold shadow-2xs flex flex-col items-center gap-1 transition-all"
          >
            <User className="w-4 h-4 text-orange-600" />
            <span>Customer Demo</span>
          </button>

          <button
            type="button"
            onClick={handleDemoOwner}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 text-xs font-bold shadow-2xs flex flex-col items-center gap-1 transition-all"
          >
            <Store className="w-4 h-4 text-emerald-600" />
            <span>Stall Owner Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
