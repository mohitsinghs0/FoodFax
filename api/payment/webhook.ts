import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'http://127.0.0.1:8000';
const PLATFORM_WEBHOOK_SECRET = process.env.UPIQRPAY_WEBHOOK_SECRET || '';

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

function readRawBody(req: IncomingMessage & { body?: any }): Promise<string> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return Promise.resolve(req.body);
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString('utf8'));
    if (typeof req.body === 'object') return Promise.resolve(JSON.stringify(req.body));
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', () => resolve(''));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Upiqrpay-Signature',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = (req.headers['x-upiqrpay-signature'] ||
      req.headers['http_x_upiqrpay_signature'] ||
      '') as string;
    const payload: any = JSON.parse(rawBody || '{}');
    const { payment_id, order_id, status, utr_number, paid_at, amount } = payload;

    if (!order_id || !payment_id) {
      sendJson(res, 400, { success: false, message: 'Invalid webhook payload: missing order_id or payment_id' });
      return;
    }

    const supabase = getSupabaseServer();
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, total, payment_status, shop_id, shops(upiqrpay_webhook_secret)')
      .eq('id', order_id)
      .maybeSingle();

    if (orderErr || !order) {
      sendJson(res, 404, { success: false, message: `Order ${order_id} not found` });
      return;
    }

    const webhookSecret = (order as any)?.shops?.upiqrpay_webhook_secret || PLATFORM_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!signature) {
        sendJson(res, 401, { success: false, message: 'Missing X-Upiqrpay-Signature header' });
        return;
      }
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        sendJson(res, 401, { success: false, message: 'Invalid webhook signature' });
        return;
      }
    }

    if (status === 'success' || payload.event === 'payment.success') {
      // FINANCIAL VERIFICATION: Paid amount must match or exceed order total
      const paidAmount = Number(amount || 0);
      const expectedAmount = Number(order.total || 0);

      if (paidAmount > 0 && paidAmount < expectedAmount) {
        sendJson(res, 400, {
          success: false,
          message: `Underpayment rejected: received ₹${paidAmount}, expected ₹${expectedAmount}`,
        });
        return;
      }

      const now = paid_at || new Date().toISOString();
      const verifiedUtr = utr_number || payment_id;

      // Update orders table with PAID status
      await supabase
        .from('orders')
        .update({
          payment_status: 'PAID',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id);

      // Safe schema-compliant upsert in payments table
      try {
        await supabase.from('payments').upsert({
          id: `pay-${order_id}`,
          order_id,
          payment_mode: 'PAY_ONLINE',
          payment_status: 'PAID',
          amount: expectedAmount,
          transaction_id: verifiedUtr,
          provider: 'upiqrpay',
          paid_at: now,
          updated_at: new Date().toISOString(),
        });
      } catch (payErr) {
        console.warn('[Webhook] Warning updating payments table:', payErr);
      }
    }

    sendJson(res, 200, { success: true, message: 'Webhook processed successfully' });
  } catch (err: any) {
    sendJson(res, 500, { success: false, message: err?.message || 'Webhook processing error' });
  }
}
