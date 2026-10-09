import { supabase, isSupabaseConfigured } from '../supabase';
import { PaymentRecord, PaymentStatus, UPIQRPayCreateResponse, UPIQRPayStatusResponse } from '../types';

export interface CreateUpiOrderParams {
  orderId: string;
  customerPhone: string;
  customerName?: string;
  redirectUrl?: string;
  amount?: number;
  shopId?: string;
}

export interface CreateUpiOrderResult {
  success: boolean;
  data?: UPIQRPayCreateResponse;
  code?: string;
  message?: string;
}

export const paymentService = {
  /**
   * Initializes dynamic UPI QR generation via backend API
   */
  async createUpiOrder(params: CreateUpiOrderParams): Promise<CreateUpiOrderResult> {
    try {
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: params.orderId,
          customer_phone: params.customerPhone,
          customer_name: params.customerName,
          redirect_url: params.redirectUrl,
          amount: params.amount,
          shop_id: params.shopId,
        }),
      });

      const json = await response.json();
      if (json && json.data) {
        return {
          success: Boolean(json.success),
          data: {
            paymentId: json.data.payment_id || json.data.paymentId,
            orderId: json.data.order_id || json.data.orderId,
            amount: json.data.amount,
            qrCode: json.data.qr_code || json.data.qrCode,
            upiLink: json.data.upi_link || json.data.upiLink,
            payUrl: json.data.pay_url || json.data.payUrl,
            expiresAt: json.data.expires_at || json.data.expiresAt,
            status: json.data.status,
          },
          code: json.code,
          message: json.message,
        };
      }
      return json;
    } catch (err: any) {
      console.error('[PaymentService] Error creating UPI order:', err);
      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: err?.message || 'Unable to connect to payment server. Please try again.',
      };
    }
  },

  /**
   * Polls payment verification status from backend & UPIQRPay
   */
  async checkPaymentStatus(paymentId: string): Promise<{ success: boolean; data?: UPIQRPayStatusResponse; message?: string }> {
    try {
      const response = await fetch(`/api/payment/status/${paymentId}`, {
        method: 'GET',
      });
      const json = await response.json();
      if (json && json.data) {
        return {
          success: Boolean(json.success),
          data: {
            paymentId: json.data.payment_id || json.data.paymentId,
            orderId: json.data.order_id || json.data.orderId,
            amount: json.data.amount,
            status: json.data.status,
            utrNumber: json.data.utr_number || json.data.utrNumber,
            paidAt: json.data.paid_at || json.data.paidAt,
          },
          message: json.message,
        };
      }
      return json;
    } catch (err: any) {
      console.error('[PaymentService] Error checking payment status:', err);
      return { success: false, message: err?.message };
    }
  },

  /**
   * Sandbox simulation helper for instant testing
   */
  async simulatePaymentSuccess(orderId: string, paymentId?: string): Promise<boolean> {
    try {
      const response = await fetch('/api/payment/simulate-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, payment_id: paymentId }),
      });
      const data = await response.json();
      return Boolean(data.success);
    } catch (err) {
      console.warn('[PaymentService] Simulation error:', err);
      return false;
    }
  },

  /**
   * Subscribes to realtime updates for a specific order and payment
   */
  subscribeToPaymentUpdates(
    orderId: string,
    onStatusChange: (status: PaymentStatus, utrNumber?: string) => void
  ): () => void {
    if (!isSupabaseConfigured) {
      // Mock fallback: polling check
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/payment/status/${orderId}`);
          const json = await res.json();
          if (json?.data?.status === 'PAID') {
            onStatusChange('PAID', json.data.utr_number);
          }
        } catch {}
      }, 3000);
      return () => clearInterval(interval);
    }

    const channelName = `payment-track-${orderId}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // 1. Listen for updates on public.orders
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload: any) => {
        const newStatus = payload.new?.payment_status as PaymentStatus;
        if (newStatus) {
          onStatusChange(newStatus);
        }
      }
    );

    // 2. Listen for updates on public.payments
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `order_id=eq.${orderId}`,
      },
      (payload: any) => {
        const newStatus = payload.new?.payment_status as PaymentStatus;
        const utr = payload.new?.utr_number || payload.new?.transaction_id;
        if (newStatus) {
          onStatusChange(newStatus, utr);
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

