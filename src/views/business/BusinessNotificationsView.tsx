import React, { useState } from 'react';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { notificationService } from '../../services/notificationService';
import { Bell, Volume2, CheckCircle2, Clock, Flame, ShieldAlert, Sparkles } from 'lucide-react';

interface StallNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'order' | 'ready' | 'system';
  read: boolean;
}

const SAMPLE_NOTIFICATIONS: StallNotification[] = [
  {
    id: 'notif-1',
    title: 'New Order Received',
    message: 'Token #A-101 received for Butter Vada Pav & Masala Chai',
    timestamp: '2 mins ago',
    type: 'order',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Token Called Successfully',
    message: 'Audio announcement triggered for Token #A-099',
    timestamp: '15 mins ago',
    type: 'ready',
    read: true,
  },
  {
    id: 'notif-3',
    title: 'Peak Rush Alert',
    message: '5 orders placed in the last 10 minutes. Consider enabling Rush Mode.',
    timestamp: '45 mins ago',
    type: 'system',
    read: true,
  },
];

export const BusinessNotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<StallNotification[]>(SAMPLE_NOTIFICATIONS);

  const handleTestSound = (type: 'order_created' | 'order_ready' | 'rush_mode') => {
    notificationService.playChime(type);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <BusinessLayout activeTab="notifications">
      <div className="max-w-xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Kitchen Alerts & Audio Chimes
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant notification history and audio buzzer testing
            </p>
          </div>

          <button
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
          >
            Mark all read
          </button>
        </div>

        {/* Audio Buzzer Tester */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Volume2 className="w-4 h-4 text-orange-500" />
            <span>Test Kitchen Audio Bells</span>
          </div>
          <p className="text-xs text-slate-500">
            Click to test if your browser sound is unmuted for noisy stall environments:
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => handleTestSound('order_created')}
              className="p-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200 transition-colors"
            >
              Order Bell 🛎️
            </button>
            <button
              onClick={() => handleTestSound('order_ready')}
              className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors"
            >
              Token Ready 📢
            </button>
            <button
              onClick={() => handleTestSound('rush_mode')}
              className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition-colors"
            >
              Rush Alert ⚡
            </button>
          </div>
        </div>

        {/* Notifications History List */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 sm:p-5 flex items-start gap-3.5 transition-colors ${
                !n.read ? 'bg-orange-50/30' : 'bg-white'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  n.type === 'order'
                    ? 'bg-orange-100 text-orange-600'
                    : n.type === 'ready'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-amber-100 text-amber-600'
                }`}
              >
                {n.type === 'order' && <Clock className="w-4 h-4" />}
                {n.type === 'ready' && <CheckCircle2 className="w-4 h-4" />}
                {n.type === 'system' && <Flame className="w-4 h-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">{n.title}</h4>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{n.timestamp}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BusinessLayout>
  );
};
