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

      // Update Database: Record payment row if order already exists in DB
      try {
        if (order) {
          const paymentRow = {
            id: `pay-${order_id}`,
            order_id: order_id,
            shop_id: orderShopId,
            customer_id: order?.customer_id || null,
            amount: orderAmount,
            currency: 'INR',
            payment_mode: 'PAY_ONLINE',
            payment_status: 'PENDING',
            provider: 'upiqrpay',
            provider_payment_id: qrResult.payment_id,
            provider_order_id: qrResult.order_id,
            qr_code_data: qrResult.qr_code,
            upi_intent_url: qrResult.upi_link,
            raw_payload: qrResult,
            updated_at: new Date().toISOString(),
          };

          await getSupabaseServer().from('payments').upsert(paymentRow);
        }
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
          transaction_id: utr_number || payment_id,
          utr_number: utr_number || payment_id,
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

  // 3. Status Verification: GET /api/payment/status/:payment_id (or ?payment_id=...)
  if (url.startsWith('/api/payment/status') && method === 'GET') {
    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      const lastSegment = pathParts[pathParts.length - 1];
      const paymentId =
        parsedUrl.searchParams.get('payment_id') ||
        parsedUrl.searchParams.get('paymentId') ||
        (lastSegment !== 'status' ? lastSegment : '');
      const queryShopId = parsedUrl.searchParams.get('shop_id') || parsedUrl.searchParams.get('shopId');

      if (!paymentId) {
        sendJson(res, 400, { success: false, message: 'Missing payment_id' });
        return true;
      }

      // Check database first
      let paymentRecord: any = null;
      try {
        const { data } = await getSupabaseServer()
          .from('payments')
          .select('*')
          .eq('provider_payment_id', paymentId)
          .maybeSingle();
        paymentRecord = data;
      } catch {}

      if (paymentRecord && paymentRecord.payment_status === 'PAID') {
        sendJson(res, 200, {
          success: true,
          data: {
            payment_id: paymentId,
            order_id: paymentRecord.order_id,
            status: 'PAID',
            utr_number: paymentRecord.utr_number || paymentRecord.transaction_id || paymentId,
            paid_at: paymentRecord.paid_at,
          },
        });
        return true;
      }

      // Resolve shop-specific API key if available, otherwise Platform UPIQRPay API key
      let shopApiKey = PLATFORM_UPIQRPAY_API_KEY;
      const targetShopId = queryShopId || paymentRecord?.shop_id;
      if (targetShopId) {
        try {
          const { data: shopData } = await getSupabaseServer()
            .from('shops')
            .select('upiqrpay_api_key')
            .eq('id', targetShopId)
            .maybeSingle();
          if (shopData?.upiqrpay_api_key) {
            shopApiKey = shopData.upiqrpay_api_key.trim();
          }
        } catch {}
      }

      // Poll UPIQRPay official API
      const upiRes = await fetch(`${UPIQRPAY_BASE_URL}/order/status/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${shopApiKey}`,
        },
      });

      const upiData: any = await upiRes.json().catch(() => ({}));

      if (upiRes.ok && upiData.success && upiData.data) {
        const remoteStatus = String(upiData.data.status || '').toLowerCase(); // 'pending' | 'success' | 'expired' | 'cancelled'
        const isPaid = remoteStatus === 'success' || remoteStatus === 'paid' || remoteStatus === 'completed';
        const verifiedUtr =
          upiData.data.utr_number ||
          upiData.data.utr ||
          upiData.data.rrn ||
          (isPaid ? paymentId : undefined);

        if (isPaid) {
          const orderId = upiData.data.order_id || paymentRecord?.order_id;
          if (orderId) {
            try {
              await getSupabaseServer().from('payments').update({
                payment_status: 'PAID',
                utr_number: verifiedUtr,
                transaction_id: verifiedUtr,
                paid_at: upiData.data.paid_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq('provider_payment_id', paymentId);

              await getSupabaseServer().from('orders').update({
                payment_status: 'PAID',
                updated_at: new Date().toISOString(),
              }).eq('id', orderId);
            } catch {}
          }
        }

        sendJson(res, 200, {
          success: true,
          data: {
            payment_id: paymentId,
            order_id: upiData.data.order_id,
            amount: upiData.data.amount,
            status: isPaid ? 'PAID' : remoteStatus.toUpperCase(),
            utr_number: verifiedUtr,
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

  // 4. Strict UTR Verification & Anti-Replay Check: POST /api/payment/verify-utr
  if (url.startsWith('/api/payment/verify-utr') && method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const { order_id, payment_id, utr_number } = JSON.parse(rawBody || '{}');
      const cleanedUtr = String(utr_number || '').replace(/\s+/g, '').trim();

      // 1. Strict 12-digit NPCI RRN format check
      if (
        !/^[1-9][0-9]{11}$/.test(cleanedUtr) ||
        /(\d)\1{5,}/.test(cleanedUtr) ||
        new Set(cleanedUtr.split('')).size < 4 ||
        /^(\d{2,6})\1+$/.test(cleanedUtr)
      ) {
        sendJson(res, 400, {
          success: false,
          code: 'INVALID_UTR_FORMAT',
          message: 'Invalid 12-digit UPI UTR / Reference number.',
        });
        return true;
      }

      // 2. Database Anti-Replay Check: ensure this UTR was never used in another order
      try {
        const { data: existingRows } = await getSupabaseServer()
          .from('payments')
          .select('id, order_id, payment_status')
          .eq('transaction_id', cleanedUtr)
          .limit(5);

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          const duplicate = existingRows.some(
            (r: any) => r.order_id !== order_id && r.payment_status !== 'FAILED'
          );
          if (duplicate) {
            sendJson(res, 400, {
              success: false,
              code: 'DUPLICATE_UTR',
              message: 'This 12-digit UTR number has already been used for another order.',
            });
            return true;
          }
        }
      } catch (e) {
        console.warn('[PaymentAPI] UTR uniqueness lookup warning:', e);
      }

      // 3. If UPIQRPay payment_id exists, check gateway directly to see if bank confirmed it
      if (payment_id) {
        try {
          const upiRes = await fetch(`${UPIQRPAY_BASE_URL}/order/status/${payment_id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${PLATFORM_UPIQRPAY_API_KEY}`,
            },
          });
          const upiData: any = await upiRes.json().catch(() => ({}));
          if (upiRes.ok && upiData?.success && upiData?.data?.status === 'success') {
            const gatewayUtr = String(upiData.data.utr_number || '').trim();
            if (!gatewayUtr || gatewayUtr === cleanedUtr) {
              sendJson(res, 200, {
                success: true,
                verifiedByGateway: true,
                status: 'PAID',
                utr_number: gatewayUtr || cleanedUtr,
              });
              return true;
            }
          }
        } catch {}
      }

      // 4. For Direct UPI (personal VPA), never auto-mark PAID without shopkeeper confirmation!
      sendJson(res, 200, {
        success: true,
        verifiedByGateway: false,
        status: 'PENDING',
        utr_number: cleanedUtr,
        message: 'UTR validated and queued for stall owner bank verification.',
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, message: err?.message });
      return true;
    }
  }

  return false;
}
