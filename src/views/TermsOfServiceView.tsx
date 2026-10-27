import React, { useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { ArrowLeft, FileText, CheckCircle2, AlertCircle, Clock, ShieldAlert } from 'lucide-react';

export const TermsOfServiceView: React.FC = () => {
  const { goBack, navigate } = useRouter();

  useEffect(() => {
    document.title = 'Terms of Service | FoodFax - Street Food Ordering in Vasai-Virar';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="py-6 px-4 sm:px-6 max-w-4xl mx-auto space-y-6 pb-28 text-slate-800">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Terms of Service</h1>
          <p className="text-xs text-slate-500 mt-0.5">Last updated: October 2026 • FoodFax Platform Agreement</p>
        </div>
      </div>

      {/* Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3.5">
        <FileText className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-amber-950 space-y-1">
          <p className="font-bold">Welcome to FoodFax!</p>
          <p className="leading-relaxed text-amber-900/90">
            By creating an account, browsing food stalls, or placing an order on FoodFax, 
            you agree to the following terms and operating conditions.
          </p>
        </div>
      </div>

      {/* Terms Body */}
      <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-slate-700 bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs">
        <section className="space-y-2">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            1. Platform Role & Identity
          </h2>
          <p>
            FoodFax is a hyper-local technology platform connecting consumers with independent street food stalls, tapris, food trucks, and canteens in the Vasai-Virar region.
          </p>
          <p>
            FoodFax operates the digital software, live queue token numbering, and payment settlement infrastructure. Food preparation, ingredient freshness, stall hygiene, and order packaging are the direct responsibility of the respective food stall owner.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            2. Token Numbering & Queue Protocol
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Each order generates a sequential daily token (e.g. #101, #102). Tokens reset daily at midnight.</li>
            <li>Customers must show their live token screen or token number at the stall counter when their token is marked &quot;Ready for Pickup&quot;.</li>
            <li>Stall preparation times (e.g. 5-10m) are estimates and may vary during peak evening street rush hours.</li>
          </ul>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            3. Pricing & Payment Policy
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>All prices are in Indian Rupees (INR) and set directly by the food stall.</li>
            <li>FoodFax does not charge arbitrary price markups or hidden convenience fees. What you see is what you pay.</li>
            <li>When paying via UPI, you are transferring funds to the central FoodFax merchant account (Mohit Santosh Singh) or the stall’s authorized merchant QR. FoodFax safely settles collections with stall owners daily.</li>
          </ul>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            4. User Code of Conduct
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Generate fake orders, use automated bots, or spam counter queues.</li>
            <li>Submit fraudulent UTR / reference numbers for UPI orders. (Violators will be permanently blocked and reported per cyberlaw regulations).</li>
            <li>Engage in abusive behavior towards street vendors, kitchen staff, or delivery partners.</li>
          </ul>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900">
            5. Governing Jurisdiction
          </h2>
          <p>
            These terms are governed by the laws of India. Any disputes arising from the use of FoodFax shall be subject to the exclusive jurisdiction of the courts in Vasai / Palghar, Maharashtra.
          </p>
        </section>
      </div>

      {/* Back button */}
      <div className="text-center pt-2">
        <button
          onClick={() => navigate('/shops')}
          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
        >
          Back to Food Stalls
        </button>
      </div>
    </div>
  );
};

