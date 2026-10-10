import type { IncomingMessage, ServerResponse } from 'http';
import { handlePaymentRequest } from '../../server/paymentHandler';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = '/api/payment/webhook';
  await handlePaymentRequest(req, res);
}

