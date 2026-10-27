import React, { useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock, HelpCircle } from 'lucide-react';

export const RefundPolicyView: React.FC = () => {
  const { goBack, navigate } = useRouter();

  useEffect(() => {
    document.title = 'Refund & Cancellation Policy | FoodFax - Street Food Ordering in Vasai-Virar';
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
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Refund & Cancellation Policy</h1>
          <p className="text-xs text-slate-500 mt-0.5">Last updated: October 2026 • Consumer Protection Guidelines</p>
        </div>
      </div>

      {/* Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3.5">
        <RefreshCw className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-emerald-950 space-y-1">
          <p className="font-bold">Transparent Street Food Refunds</p>
          <p className="leading-relaxed text-emerald-900/90">
            Because street food items are prepared fresh to order, our cancellation and refund policies are designed to protect both customers and independent vendors fairly.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-slate-700 bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs">
        <section className="space-y-2">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            1. Strict Order Cancellation & Refund Protocol
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong>Before Stall Acceptance (Status: PENDING) — 100% Full Refund:</strong> Once your payment is verified and your token is generated, if the food stall owner has NOT yet accepted your order, you can cancel your order directly from the Live Order Tracker screen for an automatic, guaranteed 100% full refund.
            </li>
            <li>
              <strong>After Stall Acceptance (Status: ACCEPTED / PREPARING / READY) — Non-Cancellable:</strong> The moment the shop owner clicks &quot;Accept Order&quot;, perishable ingredients are committed to the kitchen stove. At this stage, customer cancellations and refunds are strictly not permitted, and the customer must collect the prepared order when their token is called.
            </li>
          </ul>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            2. Automatic Refunds for Stall Rejections
          </h2>
          <p>
            If a stall owner rejects your order (e.g. out of gas, ingredients finished during peak rush hour, or stall emergency closing):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>An immediate 100% refund is initiated to your originating UPI account / bank.</li>
            <li>You will receive an instant notification and status update on your tracker screen.</li>
          </ul>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            3. Quality, Spoilage, or Wrong Item Claims
          </h2>
          <p>
            If the food delivered at the counter is incorrect, missing items, or not prepared to standard:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Notify the counter supervisor immediately while at the stall. In 99% of cases, the vendor will re-prepare the item on the spot at no extra charge.</li>
            <li>If the vendor fails to resolve the issue, email <strong>support@foodfax.in</strong> within 2 hours of pickup with a photo of the receipt and food. FoodFax customer support will verify and issue a full or partial refund.</li>
          </ul>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            4. Refund Processing Timelines
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 font-bold text-slate-800 border-b border-slate-200">
                <tr>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Processing Timeline</th>
                  <th className="p-3">Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">UPI (GPay / PhonePe / Paytm / BharatPe)</td>
                  <td className="p-3 text-slate-600">Instant to 24 Business Hours</td>
                  <td className="p-3 text-slate-600">Original UPI VPA / Bank Account</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Cash at Stall Counter</td>
                  <td className="p-3 text-slate-600">Instant Physical Cash</td>
                  <td className="p-3 text-slate-600">Returned directly at stall counter</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2 pt-4 border-t border-slate-100">
          <h2 className="text-base font-black text-slate-900">5. Contact Support</h2>
          <p>Need assistance with a cancelled or failed payment?</p>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <p><strong>Support Email:</strong> support@foodfax.in</p>
            <p><strong>Response Time:</strong> Within 15 minutes during operating stall hours (10:00 AM – 11:30 PM IST)</p>
          </div>
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

