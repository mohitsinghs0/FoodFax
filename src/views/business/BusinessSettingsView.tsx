import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { shopService } from '../../services/shopService';
import { Shop } from '../../types';
import { 
  Settings, 
  Volume2, 
  Printer, 
  Utensils, 
  ArrowLeftRight, 
  QrCode,
  Key,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Save,
  AlertCircle
} from 'lucide-react';

export const BusinessSettingsView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const { soundCues, toggleSoundCues, voiceAnnouncements, toggleVoiceAnnouncements } = useAccessibility();

  const [autoPrintKOT, setAutoPrintKOT] = useState(false);
  const [tableServiceEnabled, setTableServiceEnabled] = useState(true);

  // UPIQRPay Merchant Settings
  const [targetShop, setTargetShop] = useState<Shop | null>(null);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);
  const [upiqrpayApiKey, setUpiqrpayApiKey] = useState('');
  const [upiqrpayWebhookSecret, setUpiqrpayWebhookSecret] = useState('');
  const [merchantProvider, setMerchantProvider] = useState('bharatpe');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentSaveSuccess, setPaymentSaveSuccess] = useState(false);
  const [paymentSaveError, setPaymentSaveError] = useState<string | null>(null);

  const shopId = currentUser?.shopId || 'sharma-vada-pav';

  useEffect(() => {
    shopService.getShop(shopId).then((shop) => {
      if (shop) {
        setTargetShop(shop);
        setOnlinePaymentEnabled(shop.isOnlinePaymentEnabled !== false);
        setUpiqrpayApiKey(shop.upiqrpayApiKey || '');
        setUpiqrpayWebhookSecret(shop.upiqrpayWebhookSecret || '');
        setMerchantProvider(shop.merchantProvider || 'bharatpe');
      }
    });
  }, [shopId]);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetShop) return;

    setIsSavingPayment(true);
    setPaymentSaveError(null);
    setPaymentSaveSuccess(false);

    try {
      const updatedShop: Shop = {
        ...targetShop,
        isOnlinePaymentEnabled: onlinePaymentEnabled,
        upiqrpayApiKey: upiqrpayApiKey.trim() || undefined,
        upiqrpayWebhookSecret: upiqrpayWebhookSecret.trim() || undefined,
        merchantProvider,
      };

      await shopService.updateShop(targetShop.id, updatedShop);
      setTargetShop(updatedShop);
      setPaymentSaveSuccess(true);
      setTimeout(() => setPaymentSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving payment config:', err);
      setPaymentSaveError(err?.message || 'Failed to save payment settings.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleSwitchToCustomer = () => {
    navigate('/');
  };

  return (
    <BusinessLayout activeTab="settings">
      <div className="max-w-xl mx-auto space-y-6 pb-20">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-500" />
            Terminal & Gateway Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure UPI payment routing, audio chimes, receipt printing, and kitchen preferences
          </p>
        </div>

        {/* UPIQRPay Merchant Settings Box */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">UPIQRPay Merchant Gateway</h3>
                <p className="text-[11px] text-slate-400">Direct-to-bank UPI payment settlement for this stall</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              upiqrpayApiKey ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {upiqrpayApiKey ? 'Shop Key Active' : 'Platform Default Key'}
            </span>
          </div>

          <form onSubmit={handleSavePaymentSettings} className="space-y-4">
            {/* Toggle Online Payments */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <h4 className="font-bold text-xs text-slate-800">Accept Online UPI Payments</h4>
                <p className="text-[10px] text-slate-500">Allow customers to scan dynamic QR code at checkout</p>
              </div>
              <button
                type="button"
                onClick={() => setOnlinePaymentEnabled(!onlinePaymentEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  onlinePaymentEnabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    onlinePaymentEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Merchant Connector Alert */}
            <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Multi-Merchant Isolation:</strong> Each shop connects their own BharatPe / PhonePe / Paytm merchant account via the UPIQRPay dashboard to ensure money goes directly into their own bank account.
                <a
                  href="https://upiqrpay.in/dashboard/merchants"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline ml-1"
                >
                  Connect Merchant <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* UPIQRPay API Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                Stall UPIQRPay API Key
              </label>
              <input
                type="password"
                value={upiqrpayApiKey}
                onChange={(e) => setUpiqrpayApiKey(e.target.value)}
                placeholder="e.g. e8b41962-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Found in UPIQRPay Dashboard → API Keys</p>
            </div>

            {/* UPIQRPay Webhook Secret */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                Webhook Secret (HMAC-SHA256 Verification)
              </label>
              <input
                type="password"
                value={upiqrpayWebhookSecret}
                onChange={(e) => setUpiqrpayWebhookSecret(e.target.value)}
                placeholder="Optional webhook signing secret"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Used to verify genuine payment events from UPIQRPay servers</p>
            </div>

            {/* Merchant Provider */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Connected Merchant Provider
              </label>
              <select
                value={merchantProvider}
                onChange={(e) => setMerchantProvider(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white"
              >
                <option value="bharatpe">BharatPe Business QR</option>
                <option value="phonepe">PhonePe Business</option>
                <option value="paytm">Paytm for Business</option>
              </select>
            </div>

            {paymentSaveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                Payment settings saved successfully!
              </div>
            )}

            {paymentSaveError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                {paymentSaveError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingPayment}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSavingPayment ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Payment Config...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Payment Settings</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preferences Box */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Audio Chime */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">Audio Chimes & Sound Bells</h4>
                <p className="text-[11px] text-slate-400">Play sound effect on incoming orders and token ready</p>
              </div>
            </div>
            <button
              onClick={toggleSoundCues}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                soundCues ? 'bg-orange-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  soundCues ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Voice Token Announcement */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">Voice Token Announcements</h4>
                <p className="text-[11px] text-slate-400">Use browser speech synthesizer to call ready tokens aloud</p>
              </div>
            </div>
            <button
              onClick={toggleVoiceAnnouncements}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                voiceAnnouncements ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  voiceAnnouncements ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Table Service */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">Accept Dine-In Table Orders</h4>
                <p className="text-[11px] text-slate-400">Allow customers to input table numbers</p>
              </div>
            </div>
            <button
              onClick={() => setTableServiceEnabled(!tableServiceEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                tableServiceEnabled ? 'bg-blue-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  tableServiceEnabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Auto Print KOT */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">Auto-Print Kitchen Slip (KOT)</h4>
                <p className="text-[11px] text-slate-400">Trigger thermal print dialog when new token arrives</p>
              </div>
            </div>
            <button
              onClick={() => setAutoPrintKOT(!autoPrintKOT)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                autoPrintKOT ? 'bg-purple-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  autoPrintKOT ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="space-y-3">
          <button
            onClick={handleSwitchToCustomer}
            className="w-full py-3.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-orange-500" />
            <span>Switch to Customer App View</span>
          </button>
        </div>
      </div>
    </BusinessLayout>
  );
};
