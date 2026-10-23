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
    const rawBody = await readRawBody(req);
    const signature = (req.headers['x-upiqrpay-signature'] ||
      req.headers['http_x_upiqrpay_signature'] ||
      '') as string;
    const payload: any = JSON.parse(rawBody || '{}');
    const { payment_id, order_id, status, utr_number, paid_at } = payload;

    if (!order_id || !payment_id) {
      sendJson(res, 400, { success: false, message: 'Invalid webhook payload' });
      return;
    }

    const supabase = getSupabaseServer();
    const { data: order } = await supabase
      .from('orders')
      .select('*, shops(upiqrpay_webhook_secret)')
      .eq('id', order_id)
      .maybeSingle();

    const webhookSecret = order?.shops?.upiqrpay_webhook_secret || PLATFORM_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
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
      const now = paid_at || new Date().toISOString();
      await supabase.from('payments').upsert({
        id: `pay-${order_id}`,
        order_id,
        payment_status: 'PAID',
        transaction_id: utr_number || payment_id,
        utr_number: utr_number || payment_id,
        provider_payment_id: payment_id,
        paid_at: now,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      });

      await supabase
        .from('orders')
        .update({
          payment_status: 'PAID',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id);
    }

    sendJson(res, 200, { success: true, message: 'Webhook processed successfully' });
  } catch (err: any) {
    sendJson(res, 500, { success: false, message: err?.message || 'Webhook error' });
  }
}
