import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { orderService, pruneExpiredOrders, assertNoSensitiveFinancialData } from './orderService';
import { Order, OrderStatus } from '../types';

describe('Order Service Suite (TDD)', () => {
  const baseOrder: Order = {
    id: 'ord-test-tdd-101',
    tokenNumber: '#101',
    shopId: 'shop-sharma-vada-pav',
    shopName: 'Sharma Vada Pav',
    shopLocation: 'Near Dadar Station, Mumbai',
    customerId: 'cust-tdd-user-1',
    customerName: 'Aarav Sharma',
    customerPhone: '9876543210',
    orderType: 'TAKEAWAY',
    paymentMethod: 'PAY_ONLINE',
    paymentStatus: 'PAID',
    orderStatus: 'PENDING',
    items: [
      {
        id: 'item-1',
        menuItemId: 'item-1',
        name: 'Special Vada Pav',
        price: 25,
        quantity: 2,
        isVeg: true,
      },
    ],
    subtotal: 50,
    total: 50,
    estimatedPreparationMinutes: '10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // Seed test order into memory fallback
    orderService.saveOrders([baseOrder]);
  });

  describe('1. Pre-Acceptance Cancellation & 100% Refund Guarantee', () => {
    it('allows customer to cancel an order and claims 100% full refund when status is PENDING', async () => {
      const cancelled = await orderService.cancelOrder(
        'ord-test-tdd-101',
        'Changed mind before preparation',
        'customer'
      );

      assert.ok(cancelled, 'Cancelled order should be returned');
      assert.equal(cancelled?.orderStatus, 'CANCELLED');
      assert.equal(cancelled?.cancelledBy, 'customer');
      assert.equal(cancelled?.refundStatus, 'INITIATED', 'Must initiate 100% refund');
      assert.equal(cancelled?.refundAmount, 50, 'Refund amount must equal full total');
    });

    it('strictly locks customer cancellation once stall owner accepts the order (ACCEPTED)', async () => {
      // Transition to ACCEPTED
      const acceptedOrder: Order = {
        ...baseOrder,
        id: 'ord-test-accepted-102',
        orderStatus: 'ACCEPTED',
      };
      orderService.saveOrders([acceptedOrder]);

      await assert.rejects(
        async () => {
          await orderService.cancelOrder(
            'ord-test-accepted-102',
            'I want to cancel now',
            'customer'
          );
        },
        {
          name: 'Error',
          message: /Order has already been accepted by the food stall/i,
        }
      );
    });

    it('strictly locks customer cancellation during kitchen preparation (PREPARING)', async () => {
      const preparingOrder: Order = {
        ...baseOrder,
        id: 'ord-test-prep-103',
        orderStatus: 'PREPARING',
      };
      orderService.saveOrders([preparingOrder]);

      await assert.rejects(
        async () => {
          await orderService.cancelOrder(
            'ord-test-prep-103',
            'I cannot wait anymore',
            'customer'
          );
        },
        {
          name: 'Error',
          message: /Cancellations and refunds are strictly not permitted/i,
        }
      );
    });

    it('allows shop owner to reject or cancel order even if accepted (e.g. out of ingredients)', async () => {
      const acceptedOrder: Order = {
        ...baseOrder,
        id: 'ord-test-owner-cancel-104',
        orderStatus: 'ACCEPTED',
      };
      orderService.saveOrders([acceptedOrder]);

      const cancelledByOwner = await orderService.cancelOrder(
        'ord-test-owner-cancel-104',
        'Potatoes out of stock',
        'owner'
      );

      assert.ok(cancelledByOwner);
      assert.equal(cancelledByOwner?.orderStatus, 'CANCELLED');
      assert.equal(cancelledByOwner?.cancelledBy, 'owner');
      assert.equal(cancelledByOwner?.refundStatus, 'INITIATED');
    });
  });

  describe('2. Fulfillment Lifecycle State Machine', () => {
    it('progresses sequentially: PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED', async () => {
      const seqOrder: Order = {
        ...baseOrder,
        id: 'ord-seq-105',
        orderStatus: 'PENDING',
      };
      orderService.saveOrders([seqOrder]);

      const s1 = await orderService.acceptOrder('ord-seq-105');
      assert.equal(s1?.orderStatus, 'ACCEPTED');

      const s2 = await orderService.startPreparing('ord-seq-105');
      assert.equal(s2?.orderStatus, 'PREPARING');

      const s3 = await orderService.markReady('ord-seq-105');
      assert.equal(s3?.orderStatus, 'READY');

      const s4 = await orderService.completeOrder('ord-seq-105');
      assert.equal(s4?.orderStatus, 'COMPLETED');
    });

    it('blocks illegal state skips like PENDING directly to COMPLETED', async () => {
      const illegalOrder: Order = {
        ...baseOrder,
        id: 'ord-illegal-106',
        orderStatus: 'PENDING',
      };
      orderService.saveOrders([illegalOrder]);

      await assert.rejects(
        async () => {
          await orderService.updateOrderStatus('ord-illegal-106', 'COMPLETED');
        },
        {
          name: 'Error',
          message: /Invalid state transition/i,
        }
      );
    });
  });

  describe('3. Sensitive Financial Credentials Guard', () => {
    it('throws security error if order contains credit card or CVV', () => {
      assert.throws(
        () => {
          assertNoSensitiveFinancialData({
            orderId: 'ord-hack-1',
            cardNumber: '4111222233334444',
            cvv: '123',
          });
        },
        {
          name: 'Error',
          message: /SECURITY VIOLATION.*cardNumber/i,
        }
      );
    });

    it('passes safely when order only contains non-sensitive metadata', () => {
      assert.doesNotThrow(() => {
        assertNoSensitiveFinancialData({
          orderId: 'ord-clean-1',
          tokenNumber: 101,
          total: 150,
          customerName: 'Mohit',
        });
      });
    });
  });

  describe('4. 7-Day Order Cache Pruner', () => {
    it('prunes orders older than 7 days and filters mock orders', () => {
      const now = Date.now();
      const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
      const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

      const testOrders: Order[] = [
        {
          ...baseOrder,
          id: 'ord-old-1',
          createdAt: eightDaysAgo,
        },
        {
          ...baseOrder,
          id: 'ord-recent-1',
          createdAt: twoDaysAgo,
        },
        {
          ...baseOrder,
          id: 'ord-1001', // Mock order ID
          createdAt: twoDaysAgo,
        },
      ];

      const pruned = pruneExpiredOrders(testOrders);
      assert.equal(pruned.length, 1);
      assert.equal(pruned[0].id, 'ord-recent-1');
    });
  });

  describe('5. Real-Time Order Listener Lifecycle', () => {
    it('notifies subscribers on order status change and unsubscribes cleanly', async () => {
      const testId = 'ord-listener-107';
      orderService.saveOrders([{ ...baseOrder, id: testId, orderStatus: 'PENDING' }]);

      let receivedStatus = '';
      const unsubscribe = orderService.subscribeToOrder(testId, (order) => {
        receivedStatus = order.orderStatus;
      });

      // Update status to trigger listener
      await orderService.acceptOrder(testId);
      assert.equal(receivedStatus, 'ACCEPTED');

      // Unsubscribe and verify no further triggers
      unsubscribe();
      await orderService.startPreparing(testId);
      assert.equal(receivedStatus, 'ACCEPTED', 'Listener must not fire after unsubscribe');
    });
  });
});
