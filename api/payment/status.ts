import type { IncomingMessage, ServerResponse } from 'http';
import { handlePaymentRequest } from '../../server/paymentHandler';

export default async function handler(req: IncomingMessage & { query?: Record<string, any> }, res: ServerResponse) {
  const queryId = req.query?.paymentId || req.query?.payment_id || '';
  const shopId = req.query?.shop_id || req.query?.shopId || '';
  if (queryId && (!req.url || !req.url.includes(String(queryId)))) {
    req.url = `/api/payment/status/${queryId}${shopId ? `?shop_id=${encodeURIComponent(String(shopId))}` : ''}`;
  } else if (!req.url?.startsWith('/api/payment/status')) {
    req.url = `/api/payment/status${req.url || ''}`;
  }
  await handlePaymentRequest(req, res);
}

