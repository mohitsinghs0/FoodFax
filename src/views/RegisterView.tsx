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
  AlertCircle,
  CheckCircle2 
} from 'lucide-react';

export const RegisterView: React.FC = () => {
  const { route, navigate } = useRouter();
  const { registerCustomer, registerOwner } = useAuth();
  const redirectPath = route.params?.redirect || '/';

  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (role === 'customer') {
        await registerCustomer({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password: password.trim(),
        });
        navigate('/complete-profile');
      } else {
        await registerOwner({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || `${phone.replace(/\D/g, '')}@foodflow.stall`,
          password: password.trim(),
        });
        navigate('/setup-shop');
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err?.message || 'Registration failed. Please try again.');
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
          Create FoodFlow Account
        </h1>
        <p className="text-xs text-slate-500">
          Join thousands of local food lovers and food stall owners
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Role Selector */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setRole('customer')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            role === 'customer'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>I am a Customer</span>
        </button>

        <button
          type="button"
          onClick={() => setRole('owner')}
          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            role === 'owner'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>I own a Food Stall</span>
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleRegister} className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Full Name *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Mobile Number *
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
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
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Create Password *
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          {loading ? 'Creating account...' : role === 'owner' ? 'Continue to Stall Setup' : 'Complete Registration'}
        </button>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`)}
              className="font-bold text-orange-600 hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};
