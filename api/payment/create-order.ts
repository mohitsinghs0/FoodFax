import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://aftmqdmiwvpbpsdmsfbu.supabase.co';
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
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmdG1xZG1pd3ZwYnBzZG1zZmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwOTA4NDgsImV4cCI6MjEwNTY2Njg0OH0.c6_X6H2aLyYMH_Sg9EA9tVQr-tpHY8s9Nyjo_HznBlE';
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

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upiqrpay-Signature',
  });
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upiqrpay-Signature',
    });
    res.end();
    return;
  }

  try {
    const body = await readBody(req);
    const { order_id, customer_phone, customer_name, redirect_url, amount, shop_id } = body || {};

    if (!order_id) {
      sendJson(res, 400, { success: false, message: 'Missing order_id' });
      return;
    }

    const supabase = getSupabaseServer();
    let order: any = null;
    try {
      const { data } = await supabase.from('orders').select('*').eq('id', order_id).maybeSingle();
      if (data) order = data;
    } catch {}

    const orderAmount = order ? Number(order.total) : Number(amount || 0);
    const orderShopId = order ? order.shop_id : shop_id || null;

    if (!orderAmount || orderAmount <= 0) {
      sendJson(res, 400, { success: false, message: `Invalid order amount for ${order_id}.` });
      return;
    }

    let shopApiKey = PLATFORM_UPIQRPAY_API_KEY;
    if (orderShopId) {
      try {
        const { data: shopData } = await supabase
          .from('shops')
          .select('upiqrpay_api_key')
          .eq('id', orderShopId)
          .maybeSingle();
        if (shopData?.upiqrpay_api_key) {
          shopApiKey = shopData.upiqrpay_api_key.trim();
        }
      } catch {}
    }

    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${protocol}://${host}`;
    const phone = String(customer_phone || order?.customer_phone || '9876543210')
      .replace(/\D/g, '')
      .slice(-10) || '9876543210';

    const upiPayload = {
      amount: Math.round(orderAmount),
      order_id: String(order_id),
      customer_name: customer_name || order?.customer_name || 'FoodFax Customer',
      customer_phone: phone,
      redirect_url: redirect_url || `${origin}/#/order/${order_id}`,
      webhook_url: `${origin}/api/payment/webhook`,
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
      });
      return;
    }

    const qrResult = upiData.data;

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
  } catch (err: any) {
    sendJson(res, 500, {
      success: false,
      message: err?.message || 'Internal payment gateway error',
    });
  }
}
