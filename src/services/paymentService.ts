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

const DEFAULT_UPIQRPAY_KEY =
  (import.meta as any).env?.VITE_UPIQRPAY_API_KEY || 'e8b41962-f509-4f57-9663-33ffd33e47a1';

export const paymentService = {
  /**
   * Initializes dynamic UPI QR generation via backend API (with direct UPIQRPay fallback)
   */
  async createUpiOrder(params: CreateUpiOrderParams): Promise<CreateUpiOrderResult> {
    const requestPayload = {
      order_id: params.orderId,
      customer_phone: params.customerPhone,
      customer_name: params.customerName,
      redirect_url: params.redirectUrl,
      amount: params.amount,
      shop_id: params.shopId,
    };

    try {
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
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
      console.warn('[PaymentService] Primary /api/payment/create-order failed, trying direct gateway:', err);
    }

    // Fallback: Direct call to UPIQRPay if backend middleware/serverless returned HTML or failed
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://foodfax.in';
      const phone = String(params.customerPhone || '9876543210').replace(/\D/g, '').slice(-10) || '9876543210';
      const directRes = await fetch('https://upiqrpay.in/api/v1/order/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DEFAULT_UPIQRPAY_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(Number(params.amount || 1)),
          order_id: String(params.orderId),
          customer_name: params.customerName || 'FoodFax Customer',
          customer_phone: phone,
          redirect_url: params.redirectUrl || `${origin}/#/order/${params.orderId}`,
          webhook_url: `${origin}/api/payment/webhook`,
        }),
      });

      const directJson = await directRes.json().catch(() => null);
      if (directJson && directJson.success && directJson.data) {
        return {
          success: true,
          data: {
            paymentId: directJson.data.payment_id,
            orderId: directJson.data.order_id || params.orderId,
            amount: directJson.data.amount || params.amount || 0,
            qrCode: directJson.data.qr_code,
            upiLink: directJson.data.upi_link,
            payUrl: directJson.data.pay_url,
            expiresAt: directJson.data.expires_at,
            status: directJson.data.status || 'pending',
          },
        };
      }
      if (directJson && !directJson.success) {
        return {
          success: false,
          code: directJson.code,
          message: directJson.message,
        };
      }
    } catch (fallbackErr: any) {
      console.error('[PaymentService] Direct UPIQRPay fallback error:', fallbackErr);
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
      console.warn('[PaymentService] Primary status check failed, trying direct gateway:', err);
    }

    // Fallback: Direct status check against UPIQRPay API
    try {
      const directRes = await fetch(`https://upiqrpay.in/api/v1/order/status/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${DEFAULT_UPIQRPAY_KEY}`,
        },
      });
      const directJson = await directRes.json().catch(() => null);
      if (directJson && directJson.success && directJson.data) {
        const remoteStatus = String(directJson.data.status || '').toLowerCase();
        const isPaid =
          remoteStatus === 'success' || remoteStatus === 'paid' || remoteStatus === 'completed';
        const utr =
          directJson.data.utr_number ||
          directJson.data.utr ||
          directJson.data.rrn ||
          (isPaid ? paymentId : undefined);
        return {
          success: true,
          data: {
            paymentId,
            orderId: directJson.data.order_id,
            amount: directJson.data.amount,
            status: (isPaid ? 'PAID' : remoteStatus.toUpperCase()) as any,
            utrNumber: utr,
            paidAt: directJson.data.paid_at,
          },
        };
      }
    } catch {}

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

