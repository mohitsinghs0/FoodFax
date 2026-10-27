import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { ShieldCheck, Heart, MapPin, Store, Sparkles, Lock } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <footer className="w-full bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-auto pb-24 sm:pb-10 pt-10 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Section: Brand & Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white tracking-tight">FoodFax</span>
              <span className="px-2 py-0.5 rounded-full bg-orange-600/30 text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/30">
                Vasai-Virar
              </span>
            </div>
            <p className="text-slate-400 max-w-sm leading-relaxed text-xs">
              Hyper-local digital counter ordering, live queue tokens, and direct UPI settlements for street food stalls, tapris, food trucks, and canteens.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Verified Street Stalls • Zero Platform Markup</span>
            </div>
          </div>

          {/* Quick Discover */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">Quick Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-orange-400 transition-colors text-left"
                >
                  Home & Near Me
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/shops')}
                  className="hover:text-orange-400 transition-colors text-left"
                >
                  Browse All Food Stalls
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/search')}
                  className="hover:text-orange-400 transition-colors text-left"
                >
                  Search Dishes & Fast Food
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/orders')}
                  className="hover:text-orange-400 transition-colors text-left"
                >
                  My Orders & Live Tokens
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">Legal & Compliance</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/privacy')}
                  className="hover:text-orange-400 transition-colors text-left font-medium"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/terms')}
                  className="hover:text-orange-400 transition-colors text-left font-medium"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/refunds')}
                  className="hover:text-orange-400 transition-colors text-left font-medium"
                >
                  Refund & Cancellation Policy
                </button>
              </li>
              <li>
                <span className="text-[11px] text-slate-500 block pt-1">
                  Support: support@foodfax.in
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Security note */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} FoodFax. Built with passion for street food lovers in Vasai-Virar.</p>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure 256-bit Encrypted Platform • Powered by NPCI UPI</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

