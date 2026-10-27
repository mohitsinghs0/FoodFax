import React, { useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { ArrowLeft, Shield, Lock, MapPin, Smartphone, Database, Mail } from 'lucide-react';

export const PrivacyPolicyView: React.FC = () => {
  const { goBack, navigate } = useRouter();

  useEffect(() => {
    document.title = 'Privacy Policy | FoodFax - Street Food Ordering in Vasai-Virar';
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
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-slate-500 mt-0.5">Last updated: October 2026 • Effective for all FoodFax users</p>
        </div>
      </div>

      {/* Overview Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-start gap-3.5">
        <Shield className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-orange-950 space-y-1">
          <p className="font-bold">Your Privacy is Sacred to FoodFax</p>
          <p className="leading-relaxed text-orange-900/90">
            FoodFax connects hungry foodies with street food stalls, tapris, and canteens in Vasai-Virar. 
            We collect only the bare minimum information needed to route your token, display nearby stalls, and confirm your payment.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-slate-700 bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Section 1 */}
        <section className="space-y-2">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-orange-600" />
            1. Mobile Number Collection & Usage
          </h2>
          <p>
            When registering or placing an order on FoodFax, we collect your 10-digit Indian mobile number. 
            This information is used strictly for:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Generating your unique daily queue token (e.g. #101, #102).</li>
            <li>Enabling stall chefs to notify you via SMS / WhatsApp when your order is hot and ready at the counter.</li>
            <li>Verifying authorized customer access to live order tracking links (preventing IDOR breaches).</li>
          </ul>
          <p className="font-semibold text-slate-900">
            We will NEVER sell, lease, or share your phone number with telemarketers, spammers, or third-party advertisers.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-600" />
            2. Real-Time Device Location for Stall Discovery
          </h2>
          <p>
            To discover street food vendors and food trucks near you in Vasai-Virar, FoodFax requests access to your browser’s GPS Geolocation.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>On-Demand Access:</strong> GPS coordinates are fetched only when you explicitly tap &quot;Use Precise GPS&quot; or browse nearby stalls.</li>
            <li><strong>No Background Tracking:</strong> FoodFax does not track your location in the background when the application is closed.</li>
            <li><strong>Manual Override:</strong> You can choose your local neighborhood (e.g. Vasai West, Virar Station, Nalasopara) without granting hardware GPS permissions.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-600" />
            3. UPI & Financial Transaction Privacy
          </h2>
          <p>
            FoodFax complies with Reserve Bank of India (RBI) and National Payments Corporation of India (NPCI) guidelines:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>All online payments are processed through native UPI applications (Google Pay, PhonePe, Paytm, BHIM) or official gateway partners.</li>
            <li><strong>Zero Credential Storage:</strong> FoodFax never collects, transmits, or stores your UPI PIN, ATM PIN, debit/credit card numbers, CVV, or netbanking passwords.</li>
            <li>We record only the 12-digit NPCI Bank Reference / UTR number to reconcile payments with the stall’s kitchen queue.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-600" />
            4. Local Storage Hygiene & Data Minimization
          </h2>
          <p>
            To ensure rapid offline and low-bandwidth loading on street mobile networks:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Local browser order caches older than 7 days are automatically pruned and deleted.</li>
            <li>All database queries enforce Row-Level Security (RLS) ensuring customers can only access their authenticated orders.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-orange-600" />
            5. Contact FoodFax Privacy Grievance Officer
          </h2>
          <p>
            If you have questions about your personal data, want to delete your FoodFax account, or wish to report a privacy concern, please contact:
          </p>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 space-y-1">
            <p><strong>Grievance Officer:</strong> Mohit Santosh Singh</p>
            <p><strong>Email:</strong> support@foodfax.in</p>
            <p><strong>Operating Region:</strong> Vasai-Virar Municipal Corporation (VVMC), Maharashtra 401202</p>
          </div>
        </section>
      </div>

      {/* Back to stalls action */}
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

