import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Refund Management, Security Stress & Reversal System (E2E & TDD)', () => {
  // Mock In-memory stores
  interface OrderStore {
    id: string;
    customer_id?: string;
    customer_phone?: string;
    shop_id: string;
    order_status: string;
    payment_method: string;
    payment_status: string;
    total: number;
    refund_status: string;
    refund_amount: number;
    refund_reason?: string;
    refund_utr?: string;
    cancellation_reason?: string;
    cancelled_by?: string;
  }

  interface RefundStore {
    id: string;
    order_id: string;
    amount: number;
    status: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
    reason: string;
    gateway_utr?: string;
  }

  const mockOrders: Record<string, OrderStore> = {
    'ord-pending-paid-001': {
      id: 'ord-pending-paid-001',
      customer_id: 'cust-alice-101',
      customer_phone: '9876543210',
      shop_id: 'shop-stall-a',
      order_status: 'PENDING',
      payment_method: 'PAY_ONLINE',
      payment_status: 'PAID',
      total: 120,
      refund_status: 'NONE',
      refund_amount: 0,
    },
    'ord-accepted-paid-002': {
      id: 'ord-accepted-paid-002',
      customer_id: 'cust-bob-102',
      customer_phone: '9876543211',
      shop_id: 'shop-stall-a',
      order_status: 'ACCEPTED',
      payment_method: 'PAY_ONLINE',
      payment_status: 'PAID',
      total: 80,
      refund_status: 'NONE',
      refund_amount: 0,
    },
    'ord-cash-pending-003': {
      id: 'ord-cash-pending-003',
      customer_id: 'cust-charlie-103',
      customer_phone: '9876543212',
      shop_id: 'shop-stall-a',
      order_status: 'PENDING',
      payment_method: 'CASH_AT_COUNTER',
      payment_status: 'PENDING',
      total: 50,
      refund_status: 'NONE',
      refund_amount: 0,
    },
    'ord-completed-005': {
      id: 'ord-completed-005',
      customer_id: 'cust-alice-101',
      customer_phone: '9876543210',
      shop_id: 'shop-stall-a',
      order_status: 'COMPLETED',
      payment_method: 'PAY_ONLINE',
      payment_status: 'PAID',
      total: 150,
      refund_status: 'NONE',
      refund_amount: 0,
    },
  };

  const mockRefunds: Record<string, RefundStore> = {};

  // Cancellation and Refund RPC simulation with IDOR and state guards
  function cancelOrderAndRequestRefund(
    orderId: string,
    reason: string,
    cancelledBy = 'customer',
    callerMeta?: { customerId?: string; customerPhone?: string; shopId?: string }
  ) {
    const order = mockOrders[orderId];
    if (!order) throw new Error('Order not found');

    // 1. IDOR Authorization Guard
    if (cancelledBy === 'customer') {
      const orderPhone = (order.customer_phone || '').replace(/\D/g, '').slice(-10);
      const orderCustId = order.customer_id || '';
      if (callerMeta) {
        const callerPhone = (callerMeta.customerPhone || '').replace(/\D/g, '').slice(-10);
        const callerCustId = callerMeta.customerId || '';
        const phoneMatch = Boolean(callerPhone && orderPhone && callerPhone === orderPhone);
        const idMatch = Boolean(callerCustId && orderCustId && callerCustId === orderCustId);

        if (!phoneMatch && !idMatch && (callerPhone || callerCustId)) {
          const err = new Error('Forbidden: You are not authorized to cancel an order belonging to another customer.');
          (err as any).statusCode = 403;
          throw err;
        }
      }
    } else if (cancelledBy === 'owner') {
      if (callerMeta?.shopId && callerMeta.shopId !== order.shop_id) {
        const err = new Error('Forbidden: Merchant cannot cancel an order belonging to another food stall.');
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // 2. Terminal State Guard
    if (order.order_status === 'COMPLETED') {
      const err = new Error('Order has already been completed and collected. Cancellations are strictly locked.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 3. Idempotency Guard: If already cancelled, do not duplicate refund row
    if (order.order_status === 'CANCELLED') {
      const existingRefund = Object.values(mockRefunds).find((r) => r.order_id === orderId);
      return {
        success: true,
        order_status: 'CANCELLED',
        refund_status: existingRefund?.status || order.refund_status,
        refund_amount: existingRefund?.amount || order.refund_amount,
        refund_id: existingRefund?.id,
        alreadyCancelled: true,
      };
    }

    // 4. Pre-acceptance check for customer
    if (cancelledBy === 'customer' && order.order_status !== 'PENDING') {
      throw new Error(`Order has already been accepted (${order.order_status}). Cancellations locked.`);
    }

    const isPaid = order.payment_method === 'PAY_ONLINE' || order.payment_status === 'PAID';
    order.order_status = 'CANCELLED';
    order.cancellation_reason = reason;
    order.cancelled_by = cancelledBy;

    let refundId: string | undefined;
    if (isPaid) {
      order.refund_status = 'REQUESTED';
      order.refund_amount = order.total;
      order.refund_reason = reason;

      refundId = `ref_${orderId}`;
      mockRefunds[refundId] = {
        id: refundId,
        order_id: orderId,
        amount: order.total,
        status: 'REQUESTED',
        reason,
      };
    } else {
      order.refund_status = 'NONE';
      order.refund_amount = 0;
    }

    return {
      success: true,
      order_status: order.order_status,
      refund_status: order.refund_status,
      refund_amount: order.refund_amount,
      refund_id: refundId,
      alreadyCancelled: false,
    };
  }

  // Admin completion with UTR & double-payout protection
  function completeRefundAdmin(refundId: string, utr: string) {
    if (!utr || !/^\d{12}$/.test(utr.trim())) {
      throw new Error('Valid 12-digit numeric NPCI UTR is required');
    }

    const refund = mockRefunds[refundId];
    if (!refund) throw new Error('Refund record not found');

    if (refund.status === 'COMPLETED') {
      throw new Error(`Refund is already completed with Bank UTR: ${refund.gateway_utr}. Double-disbursement is strictly blocked.`);
    }

    refund.status = 'COMPLETED';
    refund.gateway_utr = utr.trim();

    const order = mockOrders[refund.order_id];
    if (order) {
      order.refund_status = 'COMPLETED';
      order.refund_utr = utr.trim();
      order.payment_status = 'REFUNDED';
    }

    return {
      success: true,
      refund_id: refundId,
      order_id: refund.order_id,
      status: 'COMPLETED',
      utr: utr.trim(),
    };
  }

  // Admin rejection with disbursed funds invariant
  function rejectRefundAdmin(refundId: string, reason: string) {
    const refund = mockRefunds[refundId];
    if (!refund) throw new Error('Refund record not found');

    if (refund.status === 'COMPLETED') {
      throw new Error(`Cannot reject a refund that has already been completed and disbursed to the customer (Bank UTR: ${refund.gateway_utr}).`);
    }

    if (refund.status === 'REJECTED') {
      throw new Error('Refund request is already rejected.');
    }

    refund.status = 'REJECTED';
    refund.reason = reason;

    const order = mockOrders[refund.order_id];
    if (order) {
      order.refund_status = 'REJECTED';
    }

    return {
      success: true,
      refund_id: refundId,
      status: 'REJECTED',
    };
  }

  it('1. permits pre-acceptance cancellation and issues 100% full refund request', () => {
    const result = cancelOrderAndRequestRefund(
      'ord-pending-paid-001',
      'Changed mind before cooking',
      'customer',
      { customerPhone: '9876543210', customerId: 'cust-alice-101' }
    );
    assert.equal(result.success, true);
    assert.equal(result.order_status, 'CANCELLED');
    assert.equal(result.refund_status, 'REQUESTED');
    assert.equal(result.refund_amount, 120);
    assert.equal(result.alreadyCancelled, false);

    const refund = mockRefunds[result.refund_id!];
    assert.ok(refund, 'Refund row must be created in refunds table');
    assert.equal(refund.status, 'REQUESTED');
    assert.equal(refund.amount, 120);
  });

  it('2. guarantees cancellation idempotency without duplicate refunds on repeated cancel requests', () => {
    // Calling cancel on an already cancelled order
    const repeated = cancelOrderAndRequestRefund(
      'ord-pending-paid-001',
      'Duplicate click retry',
      'customer',
      { customerPhone: '9876543210' }
    );
    assert.equal(repeated.success, true);
    assert.equal(repeated.alreadyCancelled, true);
    assert.equal(repeated.refund_status, 'REQUESTED');
    assert.equal(repeated.refund_amount, 120);

    // Verify only ONE refund entry exists for this order
    const allMatchingRefunds = Object.values(mockRefunds).filter((r) => r.order_id === 'ord-pending-paid-001');
    assert.equal(allMatchingRefunds.length, 1);
  });

  it('3. strictly blocks IDOR attack when caller does not match order customer', () => {
    assert.throws(
      () =>
        cancelOrderAndRequestRefund('ord-accepted-paid-002', 'Malicious cancellation', 'customer', {
          customerPhone: '9111111111',
          customerId: 'cust-attacker-999',
        }),
      /Forbidden: You are not authorized to cancel an order belonging to another customer/
    );
  });

  it('4. strictly blocks cross-stall merchant cancellation attack', () => {
    assert.throws(
      () =>
        cancelOrderAndRequestRefund('ord-accepted-paid-002', 'Stall B trying to cancel Stall A', 'owner', {
          shopId: 'shop-stall-b-attacker',
        }),
      /Forbidden: Merchant cannot cancel an order belonging to another food stall/
    );
  });

  it('5. strictly prevents cancellation of COMPLETED terminal orders', () => {
    assert.throws(
      () =>
        cancelOrderAndRequestRefund('ord-completed-005', 'Food was bad after finishing', 'customer', {
          customerPhone: '9876543210',
        }),
      /Order has already been completed and collected/
    );
  });

  it('6. strictly locks customer cancellation once order enters ACCEPTED/PREPARING status', () => {
    assert.throws(
      () =>
        cancelOrderAndRequestRefund('ord-accepted-paid-002', 'Too late', 'customer', {
          customerPhone: '9876543211',
          customerId: 'cust-bob-102',
        }),
      /Cancellations locked/
    );
    assert.equal(mockOrders['ord-accepted-paid-002'].order_status, 'ACCEPTED');
    assert.equal(mockOrders['ord-accepted-paid-002'].refund_status, 'NONE');
  });

  it('7. cancels cash-at-counter order cleanly without triggering gateway refund', () => {
    const result = cancelOrderAndRequestRefund('ord-cash-pending-003', 'Student left queue', 'customer', {
      customerPhone: '9876543212',
    });
    assert.equal(result.success, true);
    assert.equal(result.order_status, 'CANCELLED');
    assert.equal(result.refund_status, 'NONE');
    assert.equal(result.refund_amount, 0);
  });

  it('8. admin completes refund with 12-digit UTR, reflecting COMPLETED status and bank reference to customer', () => {
    const validUtr = '431902847192';
    const adminResult = completeRefundAdmin('ref_ord-pending-paid-001', validUtr);
    assert.equal(adminResult.success, true);
    assert.equal(adminResult.status, 'COMPLETED');
    assert.equal(adminResult.utr, validUtr);

    // Customer order reflects updated UTR and status
    const order = mockOrders['ord-pending-paid-001'];
    assert.equal(order.refund_status, 'COMPLETED');
    assert.equal(order.refund_utr, validUtr);
    assert.equal(order.payment_status, 'REFUNDED');
  });

  it('9. strictly blocks double-disbursement replay attack on already COMPLETED refund', () => {
    assert.throws(
      () => completeRefundAdmin('ref_ord-pending-paid-001', '592810394812'),
      /Double-disbursement is strictly blocked/
    );
  });

  it('10. strictly blocks admin from rejecting an already disbursed COMPLETED refund', () => {
    assert.throws(
      () => rejectRefundAdmin('ref_ord-pending-paid-001', 'Fraud claim detected post-payment'),
      /Cannot reject a refund that has already been completed and disbursed/
    );
  });

  it('11. rejects invalid or non-12-digit bank UTR numbers during admin resolution', () => {
    assert.throws(
      () => completeRefundAdmin('ref_ord-disputed-fake', '123'),
      /Valid 12-digit numeric NPCI UTR is required/
    );
    assert.throws(
      () => completeRefundAdmin('ref_ord-disputed-fake', 'ABCD12345678'),
      /Valid 12-digit numeric NPCI UTR is required/
    );
  });

  it('12. allows admin to reject invalid pending refund claim with reason', () => {
    // Setup a new refund
    mockOrders['ord-disputed-004'] = {
      id: 'ord-disputed-004',
      shop_id: 'shop-stall-a',
      order_status: 'PENDING',
      payment_method: 'PAY_ONLINE',
      payment_status: 'PAID',
      total: 60,
      refund_status: 'NONE',
      refund_amount: 0,
    };
    const req = cancelOrderAndRequestRefund('ord-disputed-004', 'Disputed');
    const rejectResult = rejectRefundAdmin(req.refund_id!, 'Chargeback already resolved with merchant');
    assert.equal(rejectResult.success, true);
    assert.equal(rejectResult.status, 'REJECTED');
    assert.equal(mockOrders['ord-disputed-004'].refund_status, 'REJECTED');
  });
});
