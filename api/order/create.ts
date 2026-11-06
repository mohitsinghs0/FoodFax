import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'http://127.0.0.1:8000';

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    });
    res.end();
    return;
  }

  try {
    const body = await readBody(req);
    const { order, dbOrder } = body || {};

    if (!order || !order.id || !dbOrder || !dbOrder.shop_id) {
      sendJson(res, 400, { success: false, message: 'Missing order payload or shop_id' }, req);
      return;
    }

    const supabase = getSupabaseServer();

    // 1. Validate Shop: must be active and not closed
    const { data: shop, error: shopErr } = await supabase
      .from('shops')
      .select('id, name, is_active, is_accepting_orders')
      .eq('id', dbOrder.shop_id)
      .maybeSingle();

    if (shopErr || !shop || !shop.is_active) {
      sendJson(res, 422, { success: false, message: 'Shop is inactive or does not exist.' }, req);
      return;
    }

    if (shop.is_accepting_orders === false) {
      sendJson(res, 422, { success: false, message: 'Shop is currently closed and not accepting orders.' }, req);
      return;
    }

    // 2. Security: Server-side Line Item Price Verification
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      sendJson(res, 400, { success: false, message: 'Order must contain at least one item.' }, req);
      return;
    }

    const itemIds = order.items.map((it: any) => it.menuItemId || it.id).filter(Boolean);
    const { data: catalogItems, error: catalogErr } = await supabase
      .from('menu_items')
      .select('id, name, price, is_available')
      .eq('shop_id', dbOrder.shop_id)
      .in('id', itemIds);

    if (catalogErr || !catalogItems || catalogItems.length === 0) {
      sendJson(res, 422, { success: false, message: 'Could not verify items in shop menu.' }, req);
      return;
    }

    const catalogMap = new Map(catalogItems.map((c) => [c.id, c]));
    let verifiedSubtotal = 0;
    const sanitizedOrderItems: any[] = [];

    for (let idx = 0; idx < order.items.length; idx++) {
      const it = order.items[idx];
      const itemId = it.menuItemId || it.id;
      const catalogItem = catalogMap.get(itemId);

      if (!catalogItem) {
        sendJson(res, 422, { success: false, message: `Item ${it.name || itemId} does not belong to this shop.` }, req);
        return;
      }

      if (catalogItem.is_available === false) {
        sendJson(res, 422, { success: false, message: `Item ${catalogItem.name} is currently sold out.` }, req);
        return;
      }

      const qty = Math.max(1, Math.min(50, Math.floor(Number(it.quantity || 1))));
      const itemPrice = Number(catalogItem.price);
      verifiedSubtotal += itemPrice * qty;

      sanitizedOrderItems.push({
        id: `${order.id}-item-${idx}`,
        order_id: order.id,
        menu_item_id: catalogItem.id,
        name: catalogItem.name,
        price: itemPrice,
        quantity: qty,
        is_veg: it.isVeg ?? true,
        created_at: order.createdAt || new Date().toISOString(),
      });
    }

    // 3. Generate atomic daily token number on server
    const { data: tokenNumber } = await supabase.rpc('next_token', { p_shop_id: dbOrder.shop_id });

    // 4. Sanitize and finalize dbOrder payload
    const finalOrder = {
      ...dbOrder,
      id: order.id,
      shop_id: dbOrder.shop_id,
      shop_name: shop.name || dbOrder.shop_name,
      token_number: tokenNumber || dbOrder.token_number || '#1',
      subtotal: verifiedSubtotal,
      total: verifiedSubtotal, // strictly verified
      payment_status: 'PENDING', // NEVER trust client payment_status
      order_status: 'PENDING',
      updated_at: new Date().toISOString(),
    };

    // 5. Insert order using service role
    const { error: orderError } = await supabase.from('orders').upsert(finalOrder);
    if (orderError) {
      console.error('[API Order Create] Error inserting order:', orderError);
      sendJson(res, 500, { success: false, message: orderError.message }, req);
      return;
    }

    // 6. Insert verified line items
    if (sanitizedOrderItems.length > 0) {
      await supabase.from('order_items').upsert(sanitizedOrderItems);
    }

    sendJson(res, 200, {
      success: true,
      orderId: order.id,
      tokenNumber: finalOrder.token_number,
      total: finalOrder.total,
    }, req);
  } catch (err: any) {
    sendJson(res, 500, { success: false, message: err?.message || 'Internal server error' }, req);
  }
}
