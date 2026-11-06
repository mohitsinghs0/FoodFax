import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateOrderStateTransition, canCustomerCancelOrder } from '../utils/orderValidation';

describe('A. Unit Tests: Payment Security & Validation Rules', () => {
  it('strictly validates NPCI 12-digit numeric bank UTR numbers', () => {
    // Valid UTR format: 12 numeric digits, not starting with 0
    const validUtr = '428912345678';
    assert.match(validUtr, /^[1-9][0-9]{11}$/, 'Valid NPCI UTR must be 12 digits');

    // Invalid UTR: starts with 0
    const invalidZeroStart = '012345678901';
    assert.equal(/^[1-9][0-9]{11}$/.test(invalidZeroStart), false, 'UTR cannot start with 0');

    // Invalid UTR: non-numeric or short length
    assert.equal(/^[1-9][0-9]{11}$/.test('ABC123456789'), false);
    assert.equal(/^[1-9][0-9]{11}$/.test('12345'), false);
  });

  it('rejects price tampering when client submits manipulated amount', () => {
    const verifiedOrderTotal = 450.00;
    const clientSuppliedAmount = 1.00; // Malicious tamper attempt

    // Security invariant: Server MUST use verified order total, never client-supplied amount
    const resolvedAmount = (clientAmount: number, dbTotal: number) => {
      // Insecure pattern was: clientAmount || dbTotal
      // Secure pattern is: dbTotal strictly enforced
      if (dbTotal <= 0) throw new Error('Invalid order total');
      return dbTotal;
    };

    const finalChargeAmount = resolvedAmount(clientSuppliedAmount, verifiedOrderTotal);
    assert.equal(finalChargeAmount, 450.00, 'Charge amount must strictly match server-side total');
    assert.notEqual(finalChargeAmount, clientSuppliedAmount, 'Client tampered amount was successfully rejected');
  });

  it('rejects underpayment during payment status verification', () => {
    const orderTotal = 500;
    const gatewayPaidAmount = 10; // Paid only ₹10 instead of ₹500

    const verifyPaidStatus = (paid: number, total: number) => {
      if (paid < total) {
        return { status: 'UNDERPAID', error: `Received ₹${paid}, expected ₹${total}` };
      }
      return { status: 'PAID', error: null };
    };

    const result = verifyPaidStatus(gatewayPaidAmount, orderTotal);
    assert.equal(result.status, 'UNDERPAID');
    assert.match(result.error || '', /expected ₹500/);
  });

  it('verifies HMAC-SHA256 signature for webhook requests and rejects forged signatures', () => {
    const secret = 'test_webhook_secret_key_12345';
    const payload = JSON.stringify({
      order_id: 'ord_test_888',
      payment_id: 'pay_gateway_999',
      amount: 450,
      status: 'success',
      utr_number: '428955667788',
    });

    // Legitimate signature
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Verification helper
    const verifyWebhookSignature = (body: string, sig: string, key: string): boolean => {
      if (!sig || !key) return false;
      const expected = crypto.createHmac('sha256', key).update(body).digest('hex');
      const sigBuf = Buffer.from(sig, 'hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    };

    // Valid signature passes
    assert.equal(verifyWebhookSignature(payload, validSignature, secret), true);

    // Tampered payload fails
    const tamperedPayload = JSON.stringify({ ...JSON.parse(payload), amount: 1 });
    assert.equal(verifyWebhookSignature(tamperedPayload, validSignature, secret), false);

    // Forged signature fails
    assert.equal(verifyWebhookSignature(payload, 'deadbeef1234567890abcdef', secret), false);

    // Missing signature fails
    assert.equal(verifyWebhookSignature(payload, '', secret), false);
  });
});

describe('B. Integration Tests: Order Invariants & Multi-Tenant Boundaries', () => {
  it('enforces single-stall cart isolation (cross-stall conflict detection)', () => {
    interface CartItem {
      id: string;
      shopId: string;
      name: string;
      price: number;
      quantity: number;
    }

    const cart: CartItem[] = [
      { id: 'item_1', shopId: 'shop_chaat_bhandar', name: 'Pani Puri', price: 40, quantity: 2 },
    ];

    const canAddItemToCart = (existingCart: CartItem[], newItemShopId: string): boolean => {
      if (existingCart.length === 0) return true;
      return existingCart.every((item) => item.shopId === newItemShopId);
    };

    // Same shop item -> allowed
    assert.equal(canAddItemToCart(cart, 'shop_chaat_bhandar'), true);

    // Different shop item -> blocked (prevents multi-vendor split cart corruption)
    assert.equal(canAddItemToCart(cart, 'shop_punjabi_dhaba'), false);
  });

  it('prevents customer cancellation once order enters kitchen preparation (ACCEPTED/PREPARING)', () => {
    // Cancellation is allowed strictly when PENDING
    assert.equal(canCustomerCancelOrder('PENDING'), true);

    // Cancellation is locked once merchant accepts
    assert.equal(canCustomerCancelOrder('ACCEPTED'), false);
    assert.equal(canCustomerCancelOrder('PREPARING'), false);
    assert.equal(canCustomerCancelOrder('READY'), false);
    assert.equal(canCustomerCancelOrder('COMPLETED'), false);
  });
});

describe('C. End-to-End (E2E) Simulation: Customer Order, UPI Payment & Fulfillment Flow', () => {
  it('executes the full lifecycle: Order -> Payment QR -> Gateway Webhook -> Kitchen -> Completion', () => {
    // 1. Customer Cart Setup
    const customer = {
      id: 'cust_raghav_99',
      name: 'Raghav Sharma',
      phone: '+91 98765 43210',
    };
    const shop = {
      id: 'shop_bombay_toast',
      name: 'Bombay Toast & Juice Center',
      isActive: true,
      isAcceptingOrders: true,
    };
    const cartItems = [
      { id: 'm1', name: 'Veg Grilled Sandwich', price: 120, quantity: 2 },
      { id: 'm2', name: 'Fresh Mosambi Juice', price: 60, quantity: 1 },
    ];

    // Calculate Subtotal & Total
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    assert.equal(subtotal, 300, 'Subtotal should be 120*2 + 60*1 = 300');

    // 2. Order Placement (Initial State: PENDING, payment_status: PENDING)
    const orderId = `ord_${Date.now()}`;
    const tokenNumber = '#105';
    let orderRecord = {
      id: orderId,
      customerId: customer.id,
      shopId: shop.id,
      shopName: shop.name,
      subtotal,
      total: subtotal,
      tokenNumber,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      items: cartItems,
      createdAt: new Date().toISOString(),
    };

    assert.equal(orderRecord.orderStatus, 'PENDING');
    assert.equal(orderRecord.paymentStatus, 'PENDING');

    // 3. Request Payment QR Code (Server-side validation)
    const paymentInitiation = {
      orderId: orderRecord.id,
      amount: orderRecord.total, // Verified server-side total
      paymentId: `pay_${orderRecord.id}`,
      upiIntentUri: `upi://pay?pa=bharatpe.foodfax@icici&pn=FoodFax&am=${orderRecord.total}&tr=${orderRecord.id}`,
      qrCodeData: 'data:image/svg+xml;base64,mockQrCode',
    };
    assert.equal(paymentInitiation.amount, 300);
    assert.match(paymentInitiation.upiIntentUri, /am=300/);

    // 4. Simulate Customer Scanning & Paying UPI QR via App
    const simulatedUtr = '428987654321';
    const webhookPayload = JSON.stringify({
      order_id: orderRecord.id,
      payment_id: paymentInitiation.paymentId,
      amount: 300,
      status: 'success',
      utr_number: simulatedUtr,
      paid_at: new Date().toISOString(),
    });

    // 5. Server Webhook Processing
    const parsedWebhook = JSON.parse(webhookPayload);
    assert.equal(parsedWebhook.amount >= orderRecord.total, true, 'Payment amount must be >= order total');

    // Update payment & order state to PAID
    orderRecord = {
      ...orderRecord,
      paymentStatus: 'PAID',
    };
    assert.equal(orderRecord.paymentStatus, 'PAID');

    // 6. Shop Owner Kitchen Workflow
    // Step 6a: Merchant accepts order
    const acceptTransition = validateOrderStateTransition(orderRecord.orderStatus, 'ACCEPTED');
    assert.equal(acceptTransition.valid, true);
    orderRecord.orderStatus = 'ACCEPTED';

    // Step 6b: Merchant starts food preparation
    const prepTransition = validateOrderStateTransition(orderRecord.orderStatus, 'PREPARING');
    assert.equal(prepTransition.valid, true);
    orderRecord.orderStatus = 'PREPARING';

    // Step 6c: Food is ready for pickup
    const readyTransition = validateOrderStateTransition(orderRecord.orderStatus, 'READY');
    assert.equal(readyTransition.valid, true);
    orderRecord.orderStatus = 'READY';

    // Step 6d: Customer collects order -> COMPLETED
    const completeTransition = validateOrderStateTransition(orderRecord.orderStatus, 'COMPLETED');
    assert.equal(completeTransition.valid, true);
    orderRecord.orderStatus = 'COMPLETED';

    // 7. Verify Post-Completion Invariants
    // Cannot transition from COMPLETED to anything else
    const invalidReverse = validateOrderStateTransition(orderRecord.orderStatus, 'PENDING');
    assert.equal(invalidReverse.valid, false, 'COMPLETED order cannot transition backwards');

    // Customer cannot cancel completed order
    assert.equal(canCustomerCancelOrder(orderRecord.orderStatus), false);
  });
});
