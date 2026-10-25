import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'http://127.0.0.1:8000';

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

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  try {
    const body = await readBody(req);
    const { order, dbOrder } = body || {};

    if (!order || !order.id) {
      sendJson(res, 400, { success: false, message: 'Missing order payload' });
      return;
    }

    const supabase = getSupabaseServer();

    // 1. Insert/Upsert into orders table with service role (bypasses RLS)
    const { error: orderError } = await supabase.from('orders').upsert(dbOrder);
    if (orderError) {
      console.error('[API Order Create] Error inserting order:', orderError);
      sendJson(res, 500, { success: false, message: orderError.message });
      return;
    }

    // 2. Insert line items into order_items
    if (order.items && order.items.length > 0) {
      const orderItemRows = order.items.map((it: any, idx: number) => ({
        id: `${order.id}-item-${idx}`,
        order_id: order.id,
        menu_item_id: it.menuItemId || it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        is_veg: it.isVeg,
        created_at: order.createdAt || new Date().toISOString(),
      }));
      await supabase.from('order_items').upsert(orderItemRows);
    }

    // 3. Insert payment record if payment completed or UTR present
    if (order.paymentMethod === 'PAY_ONLINE' || order.utrNumber) {
      const now = new Date().toISOString();
      await supabase.from('payments').upsert({
        id: `pay-${order.id}`,
        order_id: order.id,
        payment_mode: order.paymentMethod || 'PAY_ONLINE',
        payment_status: order.paymentStatus || 'PENDING',
        amount: order.total,
        transaction_id: order.utrNumber || null,
        provider: order.utrNumber ? 'direct_upi_utr' : 'upiqrpay',
        paid_at: order.paymentStatus === 'PAID' ? now : null,
        updated_at: now,
      });
    }

    sendJson(res, 200, { success: true, orderId: order.id });
  } catch (err: any) {
    sendJson(res, 500, { success: false, message: err?.message || 'Internal server error' });
  }
}

