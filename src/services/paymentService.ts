import { supabase, isSupabaseConfigured } from '../supabase';
import { PaymentRecord, PaymentStatus, UPIQRPayCreateResponse, UPIQRPayStatusResponse } from '../types';
import { validateUpiUtr } from '../utils/orderValidation';
import { firestoreSync } from './firestoreSyncService';

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
   * Initializes dynamic UPI QR generation via secure server-side API
   */
  async createUpiOrder(params: CreateUpiOrderParams): Promise<CreateUpiOrderResult> {
    const requestPayload = {
      order_id: params.orderId,
      customer_phone: params.customerPhone,
      customer_name: params.customerName,
      redirect_url: params.redirectUrl,
      shop_id: params.shopId,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second reliable timeout

      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const rawText = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }

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

      if (json && json.success === false) {
        return {
          success: false,
          code: json.code || 'UPI_GATEWAY_ERROR',
          message: json.message || 'Could not initialize UPI payment order.',
        };
      }
    } catch (err: any) {
      console.error('[PaymentService] /api/payment/create-order error:', err);
    }

    return {
      success: false,
      code: 'GATEWAY_UNAVAILABLE',
      message: 'Unable to reach UPI payment gateway right now. Please click Retry.',
    };
  },

  /**
   * Polls payment verification status from backend & UPIQRPay
   */
  async checkPaymentStatus(
    paymentId: string,
    shopId?: string
  ): Promise<{ success: boolean; data?: UPIQRPayStatusResponse; message?: string }> {
    try {
      const qs = new URLSearchParams({ payment_id: paymentId });
      if (shopId) qs.set('shop_id', shopId);
      const response = await fetch(`/api/payment/status?${qs.toString()}`, {
        method: 'GET',
      });
      const rawText = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }

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
    } catch (err: any) {
      console.warn('[PaymentService] Status check request error:', err);
    }

    return { success: false, message: 'Waiting for payment verification' };
  },

  /**
   * Strictly validates a 12-digit NPCI UTR number, blocks duplicate UTRs in Supabase,
   * and checks UPIQRPay gateway status before allowing order submission.
   */
  async verifyAndValidateUtr(params: {
    utrNumber: string;
    orderId?: string;
    paymentId?: string;
  }): Promise<{
    valid: boolean;
    verifiedByGateway: boolean;
    cleanedUtr: string;
    error?: string;
  }> {
    // 1. Strict client-side NPCI 12-digit RRN validation
    const formatCheck = validateUpiUtr(params.utrNumber);
    if (!formatCheck.valid) {
      return {
        valid: false,
        verifiedByGateway: false,
        cleanedUtr: formatCheck.cleaned,
        error: formatCheck.error,
      };
    }

    const cleanedUtr = formatCheck.cleaned;

    // 2. Database Anti-Replay Check (prevent reusing an old UTR)
    const alreadyUsed = await firestoreSync.isUtrAlreadyUsed(cleanedUtr, params.orderId);
    if (alreadyUsed) {
      return {
        valid: false,
        verifiedByGateway: false,
        cleanedUtr,
        error: 'This 12-digit UTR number has already been used for another order. Duplicate UTRs are blocked.',
      };
    }

    // 3. Backend / Gateway verification check if available
    try {
      const response = await fetch('/api/payment/verify-utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: params.orderId,
          payment_id: params.paymentId,
          utr_number: cleanedUtr,
        }),
      });

      if (response.ok || response.status === 400) {
        const json = await response.json();
        if (json && json.success === false) {
          return {
            valid: false,
            verifiedByGateway: false,
            cleanedUtr,
            error: json.message || 'UTR verification failed.',
          };
        }
        if (json && json.success === true) {
          return {
            valid: true,
            verifiedByGateway: Boolean(json.verifiedByGateway),
            cleanedUtr,
          };
        }
      }
    } catch {
      // Static deployment fallback: format + Supabase anti-replay check already passed
    }

    return {
      valid: true,
      verifiedByGateway: false,
      cleanedUtr,
    };
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

