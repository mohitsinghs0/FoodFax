import React, { useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { Store, ArrowLeft, Search, Compass } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  const { navigate } = useRouter();

  useEffect(() => {
    document.title = 'Page Not Found (404) | FoodFax - Street Food in Vasai-Virar';
  }, []);

  return (
    <div className="py-16 sm:py-24 px-4 max-w-lg mx-auto text-center space-y-6">
      {/* 404 Icon & Badge */}
      <div className="relative inline-flex items-center justify-center">
        <div className="w-24 h-24 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center text-4xl shadow-md border-2 border-orange-200">
          🥟
        </div>
        <span className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono text-xs font-black tracking-wider">
          404
        </span>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Oops! Recipe Not Found
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
          The stall, menu dish, or page you are looking for has either moved to a new street corner or does not exist.
        </p>
      </div>

      {/* Primary Action Button */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => navigate('/shops')}
          className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-black shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px]"
        >
          <Store className="w-4 h-4 stroke-[2.5]" />
          <span>Back to Food Stalls</span>
        </button>

        <button
          onClick={() => navigate('/search')}
          className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold border border-slate-200 shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px]"
        >
          <Search className="w-4 h-4 stroke-[2]" />
          <span>Search Dishes</span>
        </button>
      </div>

      {/* Helpful links */}
      <div className="pt-6 border-t border-slate-200/80 flex items-center justify-center gap-4 text-xs font-semibold text-slate-500">
        <button onClick={() => navigate('/')} className="hover:text-orange-600 transition-colors">
          Home
        </button>
        <span>•</span>
        <button onClick={() => navigate('/shops')} className="hover:text-orange-600 transition-colors">
          Stalls
        </button>
        <span>•</span>
        <button onClick={() => navigate('/privacy')} className="hover:text-orange-600 transition-colors">
          Privacy
        </button>
        <span>•</span>
        <button onClick={() => navigate('/terms')} className="hover:text-orange-600 transition-colors">
          Terms
        </button>
      </div>
    </div>
  );
};

