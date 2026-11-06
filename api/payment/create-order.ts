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

function readBody(req: IncomingMessage & { body?: any }): Promise<any> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    try {
      const str = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
      return Promise.resolve(JSON.parse(str || '{}'));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
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

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
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
    const body = await readBody(req);
    const { order_id, customer_phone, customer_name, redirect_url } = body || {};

    if (!order_id) {
      sendJson(res, 400, { success: false, message: 'Missing order_id' }, req);
      return;
    }

    // SECURITY HARDENING: Never trust client-supplied amount!
    // Always look up the real, server-side verified order from Supabase
    const supabase = getSupabaseServer();
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, shop_id, customer_name, customer_phone, total, payment_status, order_status')
      .eq('id', order_id)
      .maybeSingle();

    if (orderErr || !order) {
      sendJson(res, 404, { success: false, message: `Order ${order_id} not found.` }, req);
      return;
    }

    if (order.payment_status === 'PAID') {
      sendJson(res, 400, { success: false, message: `Order ${order_id} is already paid.` }, req);
      return;
    }

    if (order.order_status === 'CANCELLED') {
      sendJson(res, 400, { success: false, message: `Order ${order_id} has been cancelled.` }, req);
      return;
    }

    const orderAmount = Number(order.total || 0);
    if (!orderAmount || orderAmount <= 0) {
      sendJson(res, 400, { success: false, message: `Invalid verified order amount for ${order_id}.` }, req);
      return;
    }

    const orderShopId = order.shop_id;
    let shopApiKey = PLATFORM_UPIQRPAY_API_KEY;

    if (orderShopId) {
      try {
        const timeoutPromise = new Promise<{ data: null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 1000)
        );
        const shopPromise = supabase
          .from('shops')
          .select('upiqrpay_api_key')
          .or(`id.eq.${orderShopId},slug.eq.${orderShopId}`)
          .maybeSingle();

        const { data: shopData } = await Promise.race([shopPromise, timeoutPromise]);
        if (shopData?.upiqrpay_api_key) {
          shopApiKey = shopData.upiqrpay_api_key.trim();
        }
      } catch {}
    }

    const host = req.headers.host || 'foodfax.in';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const reqOrigin = `${protocol}://${host}`;
    const phone = String(customer_phone || order.customer_phone || '9876543210')
      .replace(/\D/g, '')
      .slice(-10) || '9876543210';

    const upiPayload = {
      amount: Math.round(orderAmount),
      order_id: String(order_id),
      customer_name: customer_name || order.customer_name || 'FoodFax Customer',
      customer_phone: phone,
      redirect_url: redirect_url || `${reqOrigin}/#/order/${order_id}`,
      webhook_url: `${reqOrigin}/api/payment/webhook`,
    };

    const upiResponse = await fetch(`${UPIQRPAY_BASE_URL}/order/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${shopApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upiPayload),
    });

    const upiData: any = await upiResponse.json().catch(() => ({}));

    if (!upiResponse.ok || !upiData.success) {
      sendJson(res, 400, {
        success: false,
        code: upiData.code || 'UPI_GATEWAY_ERROR',
        message: upiData.message || 'UPIQRPay gateway could not create order.',
      }, req);
      return;
    }

    const qrResult = upiData.data;

    sendJson(res, 200, {
      success: true,
      data: {
        payment_id: qrResult.payment_id,
        amount: orderAmount, // Server-verified amount
        order_id: qrResult.order_id || order_id,
        qr_code: qrResult.qr_code,
        upi_link: qrResult.upi_link,
        pay_url: qrResult.pay_url,
        expires_at: qrResult.expires_at,
        status: qrResult.status || 'pending',
      },
    }, req);
  } catch (err: any) {
    sendJson(res, 500, {
      success: false,
      message: err?.message || 'Internal payment gateway error',
    }, req);
  }
}
