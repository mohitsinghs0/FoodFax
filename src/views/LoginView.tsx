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
  ShieldCheck, 
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  X,
  CheckCircle2
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { route, navigate } = useRouter();
  const { login, resetPassword, signInWithGoogle } = useAuth();
  const rawRedirect =
    route.params?.redirect ||
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('foodfax_post_login_redirect')
      : null);
  const redirectPath = rawRedirect ? decodeURIComponent(rawRedirect) : '/';

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      setError('Please enter your email or mobile number.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await login(emailOrPhone.trim(), password.trim());
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('foodfax_post_login_redirect');
      }
      if (loggedUser.role === 'owner') {
        navigate('/business');
      } else {
        navigate(redirectPath === '/business' ? '/' : redirectPath);
      }
    } catch (err: any) {
      console.warn('[LoginView] Login note:', err?.message);
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) {
      setForgotError('Please enter your mobile number or email.');
      return;
    }
    if (!newPassword.trim()) {
      setForgotError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 4) {
      setForgotError('Password must contain at least 4 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match. Please re-enter.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await resetPassword({
        emailOrPhone: forgotInput.trim(),
        newPassword: newPassword.trim(),
      });
      setForgotSuccess(res.message);
      setEmailOrPhone(forgotInput.trim());
      setPassword(newPassword.trim());
    } catch (err: any) {
      console.warn('[LoginView] Password reset error:', err?.message);
      setForgotError(err?.message || 'Password reset failed. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Welcome to FoodFax
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
              onChange={(e) => {
                setEmailOrPhone(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. name@example.com or 9820011223"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700">
              Password
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotInput(emailOrPhone);
                setForgotError(null);
                setForgotSuccess(null);
                setNewPassword('');
                setConfirmPassword('');
                setShowForgotModal(true);
              }}
              className="text-2xs font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your password"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
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
              className="font-bold text-orange-600 hover:underline cursor-pointer"
            >
              Sign Up Free
            </button>
          </p>
        </div>
      </form>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Reset Password</h3>
                  <p className="text-2xs text-slate-500">Set a new password for your account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-2xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-800">{forgotSuccess}</p>
                  <p className="text-2xs text-slate-500">
                    Your password has been updated in database. You can now login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors cursor-pointer"
                >
                  Continue to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Mobile Number or Email *
                  </label>
                  <input
                    type="text"
                    value={forgotInput}
                    onChange={(e) => {
                      setForgotInput(e.target.value);
                      if (forgotError) setForgotError(null);
                    }}
                    placeholder="e.g. 9876543210 or name@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (forgotError) setForgotError(null);
                      }}
                      placeholder="At least 4 characters"
                      className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-2xs font-bold text-slate-700 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (forgotError) setForgotError(null);
                    }}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                  >
                    {forgotLoading ? 'Updating...' : 'Set Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
