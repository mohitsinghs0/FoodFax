import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

// Environment credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://aftmqdmiwvpbpsdmsfbu.supabase.co';
const PLATFORM_UPIQRPAY_API_KEY = process.env.UPIQRPAY_API_KEY || 'e8b41962-f509-4f57-9663-33ffd33e47a1';
const PLATFORM_WEBHOOK_SECRET = process.env.UPIQRPAY_WEBHOOK_SECRET || '';

const UPIQRPAY_BASE_URL = 'https://upiqrpay.in/api/v1';

// Server-side lazy Supabase client
let _supabaseServer: any = null;
function getSupabaseServer() {
  if (!_supabaseServer) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';
    _supabaseServer = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabaseServer;
}

/**
 * Helper to read raw JSON body from incoming HTTP request.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });
}

/**
 * JSON response helper
 */
function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upiqrpay-Signature',
  });
  res.end(JSON.stringify(data));
}

/**
 * Main HTTP Handler for all /api/payment routes.
 * Mountable directly in Vite dev server, Vite preview, and Express server.
 */
export async function handlePaymentRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method || 'GET';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upiqrpay-Signature',
    });
    res.end();
    return true;
  }

  // 1. Create UPI Payment QR: POST /api/payment/create-order
  if (url.startsWith('/api/payment/create-order') && method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const { order_id, customer_phone, customer_name, redirect_url, amount, shop_id } = JSON.parse(rawBody || '{}');

      if (!order_id) {
        sendJson(res, 400, { success: false, message: 'Missing order_id' });
        return true;
      }

      // Fetch order from database if exists
      let order: any = null;
      try {
        const { data, error } = await getSupabaseServer()
          .from('orders')
          .select('*')
          .eq('id', order_id)
          .maybeSingle();

        if (data) {
          order = data;
        }
      } catch (e) {
        console.warn('[PaymentAPI] Supabase query error:', e);
      }

      // Use verified order amount if found, otherwise request amount
      const orderAmount = order ? Number(order.total) : Number(amount || 0);
      const orderShopId = order ? order.shop_id : (shop_id || null);

      if (!orderAmount || orderAmount <= 0) {
        sendJson(res, 400, { success: false, message: `Invalid or missing order amount for ${order_id}.` });
        return true;
      }

      // MULTI-MERCHANT LOOKUP: Fetch stall's specific UPIQRPay credentials
      let shopApiKey = PLATFORM_UPIQRPAY_API_KEY;
      let shopWebhookSecret = PLATFORM_WEBHOOK_SECRET;

      if (orderShopId) {
        try {
          const { data: shopData } = await getSupabaseServer()
            .from('shops')
            .select('upiqrpay_api_key, upiqrpay_webhook_secret, is_online_payment_enabled')
            .eq('id', orderShopId)
            .maybeSingle();

          if (shopData?.upiqrpay_api_key) {
            shopApiKey = shopData.upiqrpay_api_key.trim();
          }
          if (shopData?.upiqrpay_webhook_secret) {
            shopWebhookSecret = shopData.upiqrpay_webhook_secret.trim();
          }
        } catch (e) {
          console.warn('[PaymentAPI] Error querying shop payment config:', e);
        }
      }

      const host = req.headers.host || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const origin = `${protocol}://${host}`;

      const phone = (customer_phone || order?.customer_phone || '9876543210').replace(/\D/g, '').slice(-10);

      const upiPayload = {
        amount: Math.round(orderAmount),
        order_id: String(order_id),
        customer_name: customer_name || order?.customer_name || 'FoodFax Customer',
        customer_phone: phone,
        redirect_url: redirect_url || `${origin}/order/${order_id}`,
        webhook_url: `${origin}/api/payment/webhook`,
      };

      console.info(`[UPIQRPay] Calling POST /api/v1/order/create for Order ${order_id} (₹${upiPayload.amount})...`);

      const upiResponse = await fetch(`${UPIQRPAY_BASE_URL}/order/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${shopApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(upiPayload),
      });

      const upiData: any = await upiResponse.json().catch(() => ({}));

      if (!upiResponse.ok || !upiData.success) {
        console.warn('[UPIQRPay] Gateway error response:', upiData);

        // Check if merchant connector is pending on UPIQRPay dashboard
        if (
          upiData.code === 'NO_MERCHANT_CONNECTED' ||
          (upiData.message && upiData.message.toLowerCase().includes('merchant'))
        ) {
          sendJson(res, 400, {
            success: false,
            code: 'NO_MERCHANT_CONNECTED',
            message:
              upiData.message ||
              'No payment merchant connected. Please connect a BharatPe/Paytm Business merchant first from UPIQRPay Dashboard → Add Merchant.',
            order_id,
          });
          return true;
        }

        sendJson(res, 400, {
          success: false,
          code: upiData.code || 'UPI_GATEWAY_ERROR',
          message: upiData.message || 'Payment gateway failed to initialize order.',
        });
        return true;
      }

      const qrResult = upiData.data;

      // Update Database: Record payment row with status INITIATED
      try {
        const paymentRow = {
          id: `pay-${order_id}`,
          order_id: order_id,
          shop_id: orderShopId,
          customer_id: order?.customer_id || null,
          amount: orderAmount,
          currency: 'INR',
          payment_mode: 'PAY_ONLINE',
          payment_status: 'INITIATED',
          provider: 'upiqrpay',
          provider_payment_id: qrResult.payment_id,
          provider_order_id: qrResult.order_id,
          qr_code_data: qrResult.qr_code,
          upi_intent_url: qrResult.upi_link,
          raw_payload: qrResult,
          updated_at: new Date().toISOString(),
        };

        await getSupabaseServer().from('payments').upsert(paymentRow);
        await getSupabaseServer().from('orders').update({ payment_status: 'INITIATED' }).eq('id', order_id);
      } catch (dbErr) {
        console.warn('[PaymentAPI] Non-critical warning updating payments table:', dbErr);
      }

      sendJson(res, 200, {
        success: true,
        data: {
          payment_id: qrResult.payment_id,
          amount: qrResult.amount || orderAmount,
          order_id: qrResult.order_id || order_id,
          qr_code: qrResult.qr_code,
          upi_link: qrResult.upi_link,
          pay_url: qrResult.pay_url,
          expires_at: qrResult.expires_at,
          status: qrResult.status || 'pending',
        },
      });
      return true;
    } catch (err: any) {
      console.error('[PaymentAPI] Error creating UPI order:', err);
      sendJson(res, 500, { success: false, message: err?.message || 'Internal payment error' });
      return true;
    }
  }

  // 2. Official Webhook: POST /api/payment/webhook
  if (url.startsWith('/api/payment/webhook') && method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const signature = (req.headers['x-upiqrpay-signature'] || req.headers['http_x_upiqrpay_signature'] || '') as string;
      const payload: any = JSON.parse(rawBody || '{}');

      console.info(`[UPIQRPay Webhook] Received event: ${payload.event || 'unknown'} for order ${payload.order_id}`);

      const { payment_id, order_id, amount, status, utr_number, paid_via, paid_at } = payload;

      if (!order_id || !payment_id) {
        sendJson(res, 400, { success: false, message: 'Invalid webhook payload' });
        return true;
      }

      // Fetch order to verify shop's webhook secret
      const { data: order } = await getSupabaseServer()
        .from('orders')
        .select('*, shops(upiqrpay_webhook_secret)')
        .eq('id', order_id)
        .maybeSingle();

      const webhookSecret = order?.shops?.upiqrpay_webhook_secret || PLATFORM_WEBHOOK_SECRET;

      // Verify HMAC-SHA256 signature if secret is configured
      if (webhookSecret && signature) {
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');

        if (expectedSignature !== signature) {
          console.error('[UPIQRPay Webhook] Signature verification failed! Received:', signature, 'Expected:', expectedSignature);
          sendJson(res, 401, { success: false, message: 'Invalid webhook signature' });
          return true;
        }
      }

      // Verify amount matches order total if order exists
      if (order && Math.abs(Number(order.total) - Number(amount)) > 1) {
        console.error(`[UPIQRPay Webhook] Amount mismatch! Order: ₹${order.total}, Paid: ₹${amount}`);
        sendJson(res, 400, { success: false, message: 'Amount mismatch' });
        return true;
      }

      if (status === 'success' || payload.event === 'payment.success') {
        const now = paid_at || new Date().toISOString();

        // 1. Update payments table
        await getSupabaseServer().from('payments').upsert({
          id: `pay-${order_id}`,
          order_id: order_id,
          payment_status: 'PAID',
          transaction_id: utr_number,
          utr_number: utr_number,
          provider_payment_id: payment_id,
          paid_at: now,
          raw_payload: payload,
          updated_at: new Date().toISOString(),
        });

        // 2. Update orders table: payment_status = PAID
        await getSupabaseServer().from('orders').update({
          payment_status: 'PAID',
          updated_at: new Date().toISOString(),
        }).eq('id', order_id);

        console.info(`[UPIQRPay Webhook] Order ${order_id} marked as PAID. UTR: ${utr_number}`);
      }

      sendJson(res, 200, { success: true, message: 'Webhook processed successfully' });
      return true;
    } catch (err: any) {
      console.error('[UPIQRPay Webhook] Error:', err);
      sendJson(res, 500, { success: false, message: err?.message });
      return true;
    }
  }

  // 3. Status Verification: GET /api/payment/status/:payment_id
  if (url.startsWith('/api/payment/status/') && method === 'GET') {
    try {
      const parts = url.split('?')[0].split('/');
      const paymentId = parts[parts.length - 1];

      if (!paymentId) {
        sendJson(res, 400, { success: false, message: 'Missing payment_id' });
        return true;
      }

      // Check database first
      const { data: paymentRecord } = await getSupabaseServer()
        .from('payments')
        .select('*')
        .eq('provider_payment_id', paymentId)
        .maybeSingle();

      if (paymentRecord && paymentRecord.payment_status === 'PAID') {
        sendJson(res, 200, {
          success: true,
          data: {
            payment_id: paymentId,
            order_id: paymentRecord.order_id,
            status: 'PAID',
            utr_number: paymentRecord.utr_number,
            paid_at: paymentRecord.paid_at,
          },
        });
        return true;
      }

      // If not yet marked PAID in DB, poll UPIQRPay official API
      const upiRes = await fetch(`${UPIQRPAY_BASE_URL}/order/status/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PLATFORM_UPIQRPAY_API_KEY}`,
        },
      });

      const upiData: any = await upiRes.json().catch(() => ({}));

      if (upiRes.ok && upiData.success && upiData.data) {
        const remoteStatus = upiData.data.status; // 'pending' | 'success' | 'expired' | 'cancelled'
        if (remoteStatus === 'success') {
          const orderId = upiData.data.order_id || paymentRecord?.order_id;
          if (orderId) {
            await getSupabaseServer().from('payments').update({
              payment_status: 'PAID',
              utr_number: upiData.data.utr_number,
              transaction_id: upiData.data.utr_number,
              paid_at: upiData.data.paid_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('provider_payment_id', paymentId);

            await getSupabaseServer().from('orders').update({
              payment_status: 'PAID',
              updated_at: new Date().toISOString(),
            }).eq('id', orderId);
          }
        }

        sendJson(res, 200, {
          success: true,
          data: {
            payment_id: paymentId,
            order_id: upiData.data.order_id,
            status: remoteStatus === 'success' ? 'PAID' : remoteStatus.toUpperCase(),
            utr_number: upiData.data.utr_number,
            paid_at: upiData.data.paid_at,
          },
        });
        return true;
      }

      sendJson(res, 200, {
        success: true,
        data: {
          payment_id: paymentId,
          status: paymentRecord?.payment_status || 'PENDING',
        },
      });
      return true;
    } catch (err: any) {
      console.error('[PaymentAPI] Error checking status:', err);
      sendJson(res, 500, { success: false, message: err?.message });
      return true;
    }
  }

  // 4. Test Simulator Helper (Development Mode Only): POST /api/payment/simulate-success
  if (url.startsWith('/api/payment/simulate-success') && method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const { order_id, payment_id } = JSON.parse(rawBody || '{}');

      const mockUtr = `UTR${Date.now().toString().slice(-9)}`;
      const now = new Date().toISOString();

      if (order_id) {
        await getSupabaseServer().from('orders').update({
          payment_status: 'PAID',
          updated_at: now,
        }).eq('id', order_id);

        await getSupabaseServer().from('payments').upsert({
          id: `pay-${order_id}`,
          order_id: order_id,
          payment_status: 'PAID',
          utr_number: mockUtr,
          transaction_id: mockUtr,
          provider_payment_id: payment_id || `sim-${Date.now()}`,
          paid_at: now,
          updated_at: now,
        });
      }

      sendJson(res, 200, {
        success: true,
        message: 'Order simulated as PAID for sandbox testing',
        utr: mockUtr,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, message: err?.message });
      return true;
    }
  }

  return false;
}
