import React, { useState, useMemo } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { validatePasswordFormat } from '../services/authService';
import { 
  User, 
  AlertCircle,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';

export const RegisterView: React.FC = () => {
  const { route, navigate } = useRouter();
  const { registerCustomer } = useAuth();
  const rawRedirect =
    route.params?.redirect ||
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('foodfax_post_login_redirect')
      : null);
  const redirectPath =
    rawRedirect &&
    rawRedirect !== '/business' &&
    !rawRedirect.startsWith('/business') &&
    rawRedirect !== '/setup-shop'
      ? decodeURIComponent(rawRedirect)
      : '/';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwdValidation = useMemo(() => validatePasswordFormat(password), [password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    const cleanDigits = phone.replace(/\D/g, '');
    const last10 = cleanDigits.slice(-10);
    if (cleanDigits.length < 10 || !/^[6-9]\d{9}$/.test(last10)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!pwdValidation.isValid) {
      setError(pwdValidation.message || 'Password must be at least 6 characters with letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await registerCustomer({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password: password,
      });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('foodfax_post_login_redirect');
      }
      navigate(
        redirectPath &&
        redirectPath !== '/business' &&
        !redirectPath.startsWith('/business') &&
        redirectPath !== '/setup-shop' &&
        redirectPath !== '/'
          ? redirectPath
          : '/complete-profile'
      );
    } catch (err: any) {
      console.warn('[RegisterView] Registration note:', err?.message);
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
          <User className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Create Customer Account
        </h1>
        <p className="text-xs text-slate-500">
          Order ahead, skip counter queues, and get live digital tokens
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Customer Registration Form */}
      <form onSubmit={handleRegister} className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Full Name *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Rahul Sharma"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            10-Digit Mobile Number *
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. 9820011223"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Email Address (Optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="name@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Create Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Min 6 chars with letters & numbers"
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
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

          {/* Live Password Format Checklist */}
          <div className="mt-2 grid grid-cols-2 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
            <span className={`text-[10px] font-bold flex items-center gap-1 ${pwdValidation.checks.minLength ? 'text-emerald-600' : 'text-slate-400'}`}>
              <Check className="w-3 h-3" /> 6+ characters
            </span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${pwdValidation.checks.hasLetter ? 'text-emerald-600' : 'text-slate-400'}`}>
              <Check className="w-3 h-3" /> Letters (A-Z)
            </span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${pwdValidation.checks.hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
              <Check className="w-3 h-3" /> Numbers (0-9)
            </span>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${pwdValidation.checks.noSpaces ? 'text-emerald-600' : 'text-slate-400'}`}>
              <Check className="w-3 h-3" /> No spaces
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Confirm Password *
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Re-enter your password"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          {loading ? 'Creating account...' : 'Complete Customer Registration'}
        </button>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`)}
              className="font-bold text-orange-600 hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};
