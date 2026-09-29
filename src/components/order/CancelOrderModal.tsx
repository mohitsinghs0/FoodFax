import React, { useState } from 'react';
import { AlertTriangle, X, Check, Clock, Store } from 'lucide-react';
import { Order } from '../../types';

interface CancelOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (reason: string) => Promise<void>;
}

const COMMON_CANCELLATION_REASONS = [
  'Ordered by mistake / changed mind',
  'Wait time is too long',
  'Need to leave campus / unable to collect',
  'Selected wrong items or stall',
  'Emergency / rush',
  'Other reason',
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmCancel,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const finalReason = selectedReason === 'Other reason' && customReason.trim()
      ? customReason.trim()
      : selectedReason;

    setLoading(true);
    try {
      await onConfirmCancel(finalReason);
      onClose();
    } catch (err) {
      console.error('Failed to cancel order:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-order-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-left space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="cancel-order-title" className="text-base font-black text-slate-900">
                Cancel Order {order.tokenNumber}?
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {order.shopName} • Total ₹{order.total}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notice */}
        <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900">
          <p className="font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            <span>Order Status: {order.orderStatus}</span>
          </p>
          <p className="text-[11px] text-amber-800 mt-1 leading-snug">
            {order.orderStatus === 'PREPARING'
              ? 'Notice: The chef has already started cooking. Cancelling now sends an immediate urgent alert to the stall counter.'
              : 'Cancelling will instantly release your token slot and notify the stall owner.'}
          </p>
        </div>

        {/* Reason Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            Please select a reason for cancellation:
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {COMMON_CANCELLATION_REASONS.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-red-50 text-red-950 border border-red-200 shadow-2xs font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                  }`}
                >
                  <span>{reason}</span>
                  {isSelected && <Check className="w-4 h-4 text-red-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {selectedReason === 'Other reason' && (
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Tell us what happened..."
              className="w-full mt-2 p-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
};
