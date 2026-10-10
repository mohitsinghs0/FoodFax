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

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upiqrpay-Signature',
  });
  res.end(JSON.stringify(data));
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, any> },
  res: ServerResponse
) {
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
    let paymentRecord: any = null;
    try {
      const { data } = await supabase
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
            await supabase
              .from('payments')
              .update({
                payment_status: 'PAID',
                utr_number: verifiedUtr,
                transaction_id: verifiedUtr,
                paid_at: upiData.data.paid_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('provider_payment_id', paymentId);

            await supabase
              .from('orders')
              .update({
                payment_status: 'PAID',
                updated_at: new Date().toISOString(),
              })
              .eq('id', orderId);
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
