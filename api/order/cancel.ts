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
  });
  res.end(JSON.stringify(data));
}

function sanitizeText(input: any): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, 200);
}

export default async function handler(
  req: IncomingMessage & { body?: any; query?: Record<string, string> },
  res: ServerResponse
) {
  if (req.method === 'OPTIONS') {
    const origin = getCorsOrigin(req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed. Use POST.' }, req);
  }

  try {
    const body = await readBody(req);
    const { orderId, reason, cancelledBy = 'customer', customerId, customerPhone, shopId } = body || {};

    if (!orderId || typeof orderId !== 'string') {
      return sendJson(res, 400, { success: false, error: 'orderId string is required.' }, req);
    }

    const cleanOrderId = orderId.trim();
    const cleanReason = sanitizeText(reason) || 'Cancelled by customer';
    const cleanCancelledBy = cancelledBy === 'owner' || cancelledBy === 'admin' ? cancelledBy : 'customer';

    const supabase = getSupabaseServer();

    // 1. Fetch current order with row check
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', cleanOrderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return sendJson(res, 404, { success: false, error: `Order ${cleanOrderId} not found.` }, req);
    }

    // 1.1 IDOR Access Control: Verify caller authorization
    if (cleanCancelledBy === 'customer') {
      const orderPhone = typeof order.customer_phone === 'string' ? order.customer_phone.replace(/\D/g, '').slice(-10) : '';
      const orderCustId = typeof order.customer_id === 'string' ? order.customer_id.trim() : '';
      const hasCustomerBinding = Boolean(orderPhone || orderCustId);

      if (hasCustomerBinding) {
        const callerPhone = typeof customerPhone === 'string' ? customerPhone.replace(/\D/g, '').slice(-10) : '';
        const callerCustId = typeof customerId === 'string' ? customerId.trim() : '';

        const phoneMatch = Boolean(callerPhone && orderPhone && callerPhone === orderPhone);
        const idMatch = Boolean(callerCustId && orderCustId && callerCustId === orderCustId);

        let tokenAuthorized = false;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.split(' ')[1];
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
              const uPhone = user.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';
              if (user.id === orderCustId || (uPhone && uPhone === orderPhone)) {
                tokenAuthorized = true;
              }
            }
          } catch {}
        }

        if (!phoneMatch && !idMatch && !tokenAuthorized) {
          // If caller explicitly provided mismatching credentials or token, strictly block
          if (callerPhone || callerCustId || authHeader) {
            return sendJson(res, 403, {
              success: false,
              error: 'Forbidden: You are not authorized to cancel an order belonging to another customer.',
            }, req);
          }
        }
      }
    } else if (cleanCancelledBy === 'owner') {
      const callerShopId = typeof shopId === 'string' ? shopId.trim() : '';
      if (callerShopId && order.shop_id && callerShopId !== order.shop_id) {
        return sendJson(res, 403, {
          success: false,
          error: 'Forbidden: Merchant cannot cancel an order belonging to another food stall.',
        }, req);
      }
    }

    const currentStatus = String(order.order_status || '').toUpperCase();
    const isPaid =
      order.payment_method === 'PAY_ONLINE' ||
      String(order.payment_status || '').toUpperCase() === 'PAID';
    const totalAmount = Math.max(0, Number(order.total || 0));

    // 2. IDEMPOTENCY CHECK: If order is ALREADY cancelled, return current state without duplicate refund
    if (currentStatus === 'CANCELLED') {
      const { data: existingRefund } = await supabase
        .from('refunds')
        .select('*')
        .eq('order_id', cleanOrderId)
        .maybeSingle();

      return sendJson(res, 200, {
        success: true,
        orderId: cleanOrderId,
        orderStatus: 'CANCELLED',
        isPaid,
        refundStatus: existingRefund?.status || order.refund_status || (isPaid ? 'REQUESTED' : 'NONE'),
        refundAmount: existingRefund?.amount || totalAmount,
        refundId: existingRefund?.id || null,
        message: 'Order is already cancelled.',
        alreadyCancelled: true,
      }, req);
    }

    // 3. TERMINAL STATE PROTECTION: Completed orders can NEVER be cancelled
    if (currentStatus === 'COMPLETED') {
      return sendJson(res, 400, {
        success: false,
        error: 'Order has already been completed and collected. Cancellations and refunds are strictly locked.',
      }, req);
    }

    // 4. PRE-KITCHEN POLICY: Customers can ONLY cancel if status is PENDING
    if (cleanCancelledBy === 'customer') {
      if (currentStatus !== 'PENDING') {
        return sendJson(res, 400, {
          success: false,
          error: `Order has already been accepted by the kitchen (Status: ${currentStatus}). Cancellations are strictly locked once cooking begins.`,
        }, req);
      }
    }

    const now = new Date().toISOString();
    const refundAmount = isPaid ? totalAmount : 0;
    const refundStatus = isPaid && refundAmount > 0 ? 'REQUESTED' : 'NONE';

    // 5. Update orders table
    const orderUpdates: any = {
      order_status: 'CANCELLED',
      cancellation_reason: cleanReason,
      cancelled_at: now,
      cancelled_by: cleanCancelledBy,
      updated_at: now,
      refund_status: refundStatus,
      refund_amount: refundAmount,
      refund_reason: isPaid ? cleanReason : null,
      refund_requested_at: isPaid ? now : null,
    };

    const { error: updateErr } = await supabase
      .from('orders')
      .update(orderUpdates)
      .eq('id', cleanOrderId);

    if (updateErr) {
      console.error('[API cancel-order] Update error:', updateErr);
      return sendJson(res, 500, { success: false, error: 'Failed to update order status in database.' }, req);
    }

    // 6. Record in public.refunds with duplicate protection
    let refundRecordId: string | null = null;
    if (isPaid && refundAmount > 0) {
      // Check existing refund first
      const { data: existingRef } = await supabase
        .from('refunds')
        .select('id')
        .eq('order_id', cleanOrderId)
        .maybeSingle();

      if (existingRef?.id) {
        refundRecordId = existingRef.id;
      } else {
        const refundPayload = {
          order_id: cleanOrderId,
          customer_id: order.customer_id || null,
          customer_phone: order.customer_phone || null,
          shop_id: order.shop_id,
          amount: refundAmount,
          refund_type: 'FULL',
          status: 'REQUESTED',
          reason: cleanReason,
          created_at: now,
          updated_at: now,
        };

        const { data: refundInsert, error: refundErr } = await supabase
          .from('refunds')
          .insert(refundPayload)
          .select('id')
          .maybeSingle();

        if (!refundErr && refundInsert) {
          refundRecordId = refundInsert.id;
        }
      }

      // Update payments table to REFUND_PENDING
      await supabase
        .from('payments')
        .update({
          payment_status: 'REFUND_PENDING',
          updated_at: now,
        })
        .eq('order_id', cleanOrderId);
    }

    // 7. Audit trail in order_status_history
    try {
      await supabase.from('order_status_history').insert({
        id: `${cleanOrderId}-status-${Date.now()}`,
        order_id: cleanOrderId,
        old_status: order.order_status,
        new_status: 'CANCELLED',
        changed_by: cleanCancelledBy,
        note: `Order cancelled by ${cleanCancelledBy}: ${cleanReason}${isPaid ? ` (100% refund ₹${refundAmount} requested to original payment source)` : ''}`,
        created_at: now,
      });
    } catch {}

    return sendJson(res, 200, {
      success: true,
      orderId: cleanOrderId,
      orderStatus: 'CANCELLED',
      isPaid,
      refundStatus,
      refundAmount,
      refundId: refundRecordId,
      message: isPaid
        ? `Order cancelled. 100% full refund of ₹${refundAmount} requested to your original payment method.`
        : 'Order cancelled successfully.',
    }, req);
  } catch (err: any) {
    console.error('[API cancel-order] Fatal error:', err);
    return sendJson(res, 500, { success: false, error: err?.message || 'Internal server error.' }, req);
  }
}
