import React, { useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { 
  Settings, 
  Volume2, 
  Printer, 
  Utensils, 
  ArrowLeftRight, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react';

export const BusinessSettingsView: React.FC = () => {
  const { navigate } = useRouter();
  const { soundCues, toggleSoundCues, voiceAnnouncements, toggleVoiceAnnouncements } = useAccessibility();

  const [autoPrintKOT, setAutoPrintKOT] = useState(false);
  const [tableServiceEnabled, setTableServiceEnabled] = useState(true);
  const [resetMessage, setResetMessage] = useState(false);

  const handleResetDemo = () => {
    if (confirm('Reset all demo orders and restore initial sample stalls?')) {
      localStorage.removeItem('foodflow_orders');
      setResetMessage(true);
      setTimeout(() => {
        setResetMessage(false);
        window.location.reload();
      }, 1000);
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
            Terminal Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure audio bells, receipt printing, and kitchen terminal preferences
          </p>
        </div>

        {resetMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            Demo data successfully reset! Reloading...
          </div>
        )}

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
              className={`w-11 h-6 rounded-full transition-colors relative ${
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
              className={`w-11 h-6 rounded-full transition-colors relative ${
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
              className={`w-11 h-6 rounded-full transition-colors relative ${
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
              className={`w-11 h-6 rounded-full transition-colors relative ${
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

        {/* Mode Switcher & Reset */}
        <div className="space-y-3">
          <button
            onClick={handleSwitchToCustomer}
            className="w-full py-3.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-orange-500" />
            <span>Switch to Customer App View</span>
          </button>

          <button
            onClick={handleResetDemo}
            className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Demo Orders & Sync</span>
          </button>
        </div>
      </div>
    </BusinessLayout>
  );
};
