import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'http://127.0.0.1:8000';
const PLATFORM_UPIQRPAY_API_KEY =
  process.env.UPIQRPAY_API_KEY ||
  process.env.VITE_UPIQRPAY_API_KEY ||
  'e8b41962-f509-4f57-9663-33ffd33e47a1';
const UPIQRPAY_BASE_URL = 'https://upiqrpay.in/api/v1';

function getSupabaseServer() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNTE3Njk3LCJleHAiOjE5NTAxOTc2OTd9.m-Kkdq0uf2fr0365ulaLFOW-kWdXO35kaZnJSV_oCwo';
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ALLOWED_ORIGINS = [
  'https://foodfax.in',
  'https://www.foodfax.in',
  'https://owner.foodfax.in',
  'https://roxs.store',
  'https://www.roxs.store',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];

function getCorsOrigin(req: IncomingMessage): string {
  const origin = (req.headers.origin as string) || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/(foodfax|roxs)[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return 'https://www.foodfax.in';
}

function sendJson(res: ServerResponse, statusCode: number, data: any, req?: IncomingMessage) {
  const origin = req ? getCorsOrigin(req) : 'https://www.foodfax.in';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upiqrpay-Signature',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.end(JSON.stringify(data));
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, any> },
  res: ServerResponse
) {
  const origin = getCorsOrigin(req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upiqrpay-Signature',
      'Access-Control-Allow-Credentials': 'true',
    });
    res.end();
    return;
  }

  try {
    const parsedUrl = new URL(req.url || '/api/payment/status', 'http://localhost');
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1];

    const paymentId =
      req.query?.payment_id ||
      req.query?.paymentId ||
      parsedUrl.searchParams.get('payment_id') ||
      parsedUrl.searchParams.get('paymentId') ||
      (lastSegment && lastSegment !== 'status' ? lastSegment : '');

    const queryShopId =
      req.query?.shop_id ||
      req.query?.shopId ||
      parsedUrl.searchParams.get('shop_id') ||
      parsedUrl.searchParams.get('shopId');

    if (!paymentId) {
      sendJson(res, 400, { success: false, message: 'Missing payment_id' });
      return;
    }

    const supabase = getSupabaseServer();

    // 1. Direct check in orders table (fastest & most reliable)
    let orderRecord: any = null;
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', paymentId)
        .maybeSingle();
      orderRecord = data;
    } catch {}

    if (orderRecord && orderRecord.payment_status === 'PAID') {
      sendJson(res, 200, {
        success: true,
        data: {
          payment_id: paymentId,
          order_id: orderRecord.id,
          status: 'PAID',
          utr_number: orderRecord.utr_number || orderRecord.id,
          paid_at: orderRecord.updated_at,
        },
      });
      return;
    }

    // 2. Direct check in payments table
    let paymentRecord: any = null;
    try {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .or(`id.eq.pay-${paymentId},order_id.eq.${paymentId},transaction_id.eq.${paymentId}`)
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
          utr_number: paymentRecord.transaction_id || paymentId,
          paid_at: paymentRecord.paid_at,
        },
      });
      return;
    }

    let shopApiKey = PLATFORM_UPIQRPAY_API_KEY;
    const targetShopId = queryShopId || paymentRecord?.shop_id;
    if (targetShopId) {
      try {
        const { data: shopData } = await supabase
          .from('shops')
          .select('upiqrpay_api_key')
          .eq('id', targetShopId)
          .maybeSingle();
        if (shopData?.upiqrpay_api_key) {
          shopApiKey = shopData.upiqrpay_api_key.trim();
        }
      } catch {}
    }

    const upiRes = await fetch(`${UPIQRPAY_BASE_URL}/order/status/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${shopApiKey}`,
      },
    });

    const upiData: any = await upiRes.json().catch(() => ({}));

    if (upiRes.ok && upiData.success && upiData.data) {
      const remoteStatus = String(upiData.data.status || '').toLowerCase();
      const isPaid =
        remoteStatus === 'success' || remoteStatus === 'paid' || remoteStatus === 'completed';
      const verifiedUtr =
        upiData.data.utr_number ||
        upiData.data.utr ||
        upiData.data.rrn ||
        (isPaid ? paymentId : undefined);

      if (isPaid) {
        const orderId = upiData.data.order_id || paymentRecord?.order_id;
        if (orderId) {
          try {
            // SECURITY: Verify paid amount matches order total before updating to PAID
            const { data: orderToVerify } = await supabase
              .from('orders')
              .select('id, total, payment_status')
              .eq('id', orderId)
              .maybeSingle();

            const verifiedPaidAmount = Number(upiData.data.amount || 0);
            const expectedTotal = Number(orderToVerify?.total || 0);

            if (orderToVerify && verifiedPaidAmount > 0 && verifiedPaidAmount < expectedTotal) {
              console.error(`[Payment Security] Underpayment rejected during status check for ${orderId}: received ₹${verifiedPaidAmount}, expected ₹${expectedTotal}`);
            } else {
              await supabase
                .from('payments')
                .update({
                  payment_status: 'PAID',
                  transaction_id: verifiedUtr,
                  paid_at: upiData.data.paid_at || new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('order_id', orderId);

              await supabase
                .from('orders')
                .update({
                  payment_status: 'PAID',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);
            }
          } catch (err) {
            console.warn('[PaymentAPI] Error updating order status to PAID:', err);
          }
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
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: {
        payment_id: paymentId,
        status: paymentRecord?.payment_status || 'PENDING',
      },
    });
  } catch (err: any) {
    sendJson(res, 500, {
      success: false,
      message: err?.message || 'Error checking payment status',
    });
  }
}
