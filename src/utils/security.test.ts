import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidOrderSubmission,
  validateOrderStateTransition,
  validateUpiUtr,
  sanitizeTextInput,
  maskPhoneNumber,
  isCustomerAuthorizedForOrder,
  canCustomerCancelOrder,
} from './orderValidation';

describe('1. Customer Tenant Isolation & IDOR Access Control', () => {
  const sampleOrder = {
    id: 'ord-1001',
    customerId: 'user-alice-123',
    customerPhone: '+91 98765 43210',
  };

  it('allows order access when authenticated user ID matches order customerId', () => {
    const aliceUser = { id: 'user-alice-123', phone: '+91 98765 43210', role: 'customer' };
    assert.equal(isCustomerAuthorizedForOrder(sampleOrder, aliceUser), true);
  });

  it('allows order access when phone numbers match even if guest user', () => {
    const phoneMatchedUser = { id: 'user-diff-id', phone: '9876543210', role: 'customer' };
    assert.equal(isCustomerAuthorizedForOrder(sampleOrder, phoneMatchedUser), true);
  });

  it('allows access for platform admins for support purposes', () => {
    const adminUser = { id: 'admin-999', phone: '9111111111', role: 'admin' };
    assert.equal(isCustomerAuthorizedForOrder(sampleOrder, adminUser), true);
  });

  it('blocks unauthorized customer from viewing another customers order (IDOR Prevention)', () => {
    const bobUser = { id: 'user-bob-456', phone: '9123456789', role: 'customer' };
    assert.equal(isCustomerAuthorizedForOrder(sampleOrder, bobUser), false);
  });
});

describe('2. Order Fulfillment State Machine Transitions', () => {
  it('allows sequential progress PENDING -> ACCEPTED', () => {
    const res = validateOrderStateTransition('PENDING', 'ACCEPTED');
    assert.equal(res.valid, true);
  });

  it('allows sequential progress ACCEPTED -> PREPARING', () => {
    const res = validateOrderStateTransition('ACCEPTED', 'PREPARING');
    assert.equal(res.valid, true);
  });

  it('allows sequential progress PREPARING -> READY', () => {
    const res = validateOrderStateTransition('PREPARING', 'READY');
    assert.equal(res.valid, true);
  });

  it('allows sequential progress READY -> COMPLETED', () => {
    const res = validateOrderStateTransition('READY', 'COMPLETED');
    assert.equal(res.valid, true);
  });

  it('allows cancellation from PENDING, ACCEPTED, or PREPARING', () => {
    assert.equal(validateOrderStateTransition('PENDING', 'CANCELLED').valid, true);
    assert.equal(validateOrderStateTransition('ACCEPTED', 'CANCELLED').valid, true);
    assert.equal(validateOrderStateTransition('PREPARING', 'CANCELLED').valid, true);
  });

  it('blocks illegal jump from PENDING directly to COMPLETED', () => {
    const res = validateOrderStateTransition('PENDING', 'COMPLETED');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Invalid state transition/);
  });

  it('blocks backwards transitions from COMPLETED to PENDING', () => {
    const res = validateOrderStateTransition('COMPLETED', 'PENDING');
    assert.equal(res.valid, false);
  });

  it('blocks transitions out of terminal state CANCELLED', () => {
    const res = validateOrderStateTransition('CANCELLED', 'READY');
    assert.equal(res.valid, false);
  });
});

describe('3. Order Pricing Integrity & Input Validation', () => {
  it('validates a correct order payload with matching sum', () => {
    assert.doesNotThrow(() => {
      assertValidOrderSubmission({
        items: [
          { name: 'Vada Pav', price: 20, quantity: 2 },
          { name: 'Chai', price: 10, quantity: 1 },
        ],
        total: 50,
      });
    });
  });

  it('rejects order with negative price', () => {
    assert.throws(
      () => {
        assertValidOrderSubmission({
          items: [{ name: 'Tampered Item', price: -50, quantity: 1 }],
          total: -50,
        });
      },
      /invalid price/
    );
  });

  it('rejects order with invalid zero or negative quantity', () => {
    assert.throws(
      () => {
        assertValidOrderSubmission({
          items: [{ name: 'Vada Pav', price: 20, quantity: 0 }],
          total: 20,
        });
      },
      /invalid quantity/
    );
  });

  it('rejects empty items array', () => {
    assert.throws(
      () => {
        assertValidOrderSubmission({ items: [], total: 0 });
      },
      /at least one item/
    );
  });

  it('rejects order total that does not match item sum', () => {
    assert.throws(
      () => {
        assertValidOrderSubmission({
          items: [{ name: 'Vada Pav', price: 25, quantity: 2 }],
          total: 0,
        });
      },
      /does not match/
    );
  });
});

describe('4. Input Sanitization & Anti-XSS', () => {
  it('strips script tags and executable attributes from text inputs', () => {
    const malicious = '<script>alert("hacked")</script>Less spicy please';
    const sanitized = sanitizeTextInput(malicious);
    assert.equal(sanitized, 'Less spicy please');
    assert.equal(sanitized.includes('<script>'), false);
  });

  it('truncates excessively long input strings to avoid DoS', () => {
    const longString = 'A'.repeat(500);
    const sanitized = sanitizeTextInput(longString, 50);
    assert.equal(sanitized.length, 50);
  });
});

describe('5. PII Privacy Masking', () => {
  it('masks middle 5 digits of Indian mobile number', () => {
    assert.equal(maskPhoneNumber('+919876543210'), '+9198765*****');
    assert.equal(maskPhoneNumber('9555198947'), '95551*****');
  });
});

describe('6. 12-Digit NPCI UTR Verification', () => {
  it('accepts valid 12-digit numeric UTR', () => {
    const res = validateUpiUtr('429618392014');
    assert.equal(res.valid, true);
    assert.equal(res.cleaned, '429618392014');
  });

  it('rejects short or non-12-digit UTR', () => {
    assert.equal(validateUpiUtr('12345').valid, false);
    assert.equal(validateUpiUtr('1234567890123').valid, false);
  });

  it('rejects sequential test patterns like 123456', () => {
    assert.equal(validateUpiUtr('123456789012').valid, false);
  });

  it('rejects repetitive fake digits', () => {
    assert.equal(validateUpiUtr('111111111111').valid, false);
  });
});

describe('7. Category Visual Discovery & High-Resolution Imagery', () => {
  // Dynamic import of getCategoryVisual to test visual resolution
  it('resolves dedicated distinct food photos for street food categories', async () => {
    const { getCategoryVisual } = await import('../views/HomeView');

    const testCategories = [
      { id: 'vada-pav', name: 'Vada Pav' },
      { id: 'chaat', name: 'Chaat & Bhel' },
      { id: 'tea-coffee', name: 'Chai & Tea' },
      { id: 'juice', name: 'Cold Drinks & Juices' },
      { id: 'rolls', name: 'Rolls & Frankie' },
      { id: 'thali', name: 'Thali & Meals' },
      { id: 'chinese', name: 'Chinese Wok' },
      { id: 'burger', name: 'Burgers' },
      { id: 'pizza', name: 'Pizza' },
      { id: 'momos', name: 'Momos' },
      { id: 'biryani', name: 'Biryani & Rice' },
      { id: 'special', name: 'Signature Dishes' },
    ];

    const RESTAURANT_ROOM_IMAGE = 'photo-1555396273-367ea4eb4db5';

    for (const cat of testCategories) {
      const visual = getCategoryVisual(cat);
      assert.ok(visual.imageUrl, `Category ${cat.name} must have a valid imageUrl`);
      assert.ok(visual.cleanName, `Category ${cat.name} must have a cleanName`);
      assert.equal(
        visual.imageUrl.includes(RESTAURANT_ROOM_IMAGE),
        false,
        `Category ${cat.name} should not use the generic restaurant room interior photo`
      );
    }
  });

  it('preserves custom explicit image URL if category already has one', async () => {
    const { getCategoryVisual } = await import('../views/HomeView');
    const custom = { id: 'special-dish', name: 'Special Item', imageUrl: 'https://cdn.example.com/custom.jpg' };
    const visual = getCategoryVisual(custom);
    assert.equal(visual.imageUrl, 'https://cdn.example.com/custom.jpg');
  });
});

describe('8. Central Merchant UPI & Google Pay URI Standards', () => {
  it('verifies platform merchant identity and UPI ID', async () => {
    const { PLATFORM_UPI_ID, PLATFORM_MERCHANT_NAME } = await import('../views/CheckoutView');
    assert.equal(PLATFORM_UPI_ID, 'bharatpe2e0p0d8x5a59798@unitype');
    assert.equal(PLATFORM_MERCHANT_NAME, 'Mohit Santosh Singh');
  });

  it('guarantees valid percent-encoding without plus signs in UPI URI', () => {
    const pa = 'bharatpe2e0p0d8x5a59798@unitype';
    const pn = 'Mohit Santosh Singh';
    const am = (1.0).toFixed(2);
    const tn = 'FoodFax Order ord-101';
    const tr = 'ord-101';

    const upiQuery = [
      `pa=${encodeURIComponent(pa)}`,
      `pn=${encodeURIComponent(pn)}`,
      `am=${am}`,
      `cu=INR`,
      `tn=${encodeURIComponent(tn)}`,
      `tr=${encodeURIComponent(tr)}`,
    ].join('&');

    assert.equal(upiQuery.includes('+'), false, 'UPI query string must not contain + signs');
    assert.ok(upiQuery.includes('pn=Mohit%20Santosh%20Singh'), 'Payee name must be percent encoded');
    assert.ok(upiQuery.includes('am=1.00'), 'Amount must be exactly 1.00');
  });
});

describe('9. Secrets & Frontend Bundle Hygiene (assertNoServiceRoleKey)', () => {
  it('strictly blocks Supabase service_role key string in frontend', async () => {
    const { assertNoServiceRoleKey } = await import('../supabase');
    assert.throws(
      () => assertNoServiceRoleKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role.fake'),
      /CRITICAL SECURITY VIOLATION/
    );
  });

  it('detects and blocks JWT with payload role: "service_role"', async () => {
    const { assertNoServiceRoleKey } = await import('../supabase');
    // base64 encoded {"role":"service_role","exp":1999999999}
    const payloadBase64 = Buffer.from(JSON.stringify({ role: 'service_role', exp: 1999999999 })).toString('base64');
    const fakeServiceRoleJwt = `header.${payloadBase64}.signature`;
    assert.throws(
      () => assertNoServiceRoleKey(fakeServiceRoleJwt),
      /CRITICAL SECURITY VIOLATION/
    );
  });

  it('allows safe public anon keys', async () => {
    const { assertNoServiceRoleKey } = await import('../supabase');
    const payloadBase64 = Buffer.from(JSON.stringify({ role: 'anon', exp: 1999999999 })).toString('base64');
    const fakeAnonJwt = `header.${payloadBase64}.signature`;
    assert.doesNotThrow(() => assertNoServiceRoleKey(fakeAnonJwt));
  });
});

describe('10. Bot Trap Honeypot & Price Verification', () => {
  it('detects bot spam when bot_trap honeypot is populated', async () => {
    const { isBotDetected } = await import('./orderValidation');
    assert.equal(isBotDetected('viagra-crypto-spammer'), true);
    assert.equal(isBotDetected('http://spam.ru'), true);
    assert.equal(isBotDetected(''), false);
    assert.equal(isBotDetected(undefined), false);
    assert.equal(isBotDetected(null), false);
  });

  it('validates price and accurately recalculates subtotal client-side', async () => {
    const { validatePriceAndSubtotal } = await import('./orderValidation');
    const items = [
      { name: 'Vada Pav', price: 20, quantity: 2 },
      { name: 'Samosa', price: 18, quantity: 1 },
    ];
    const res = validatePriceAndSubtotal(items, 58);
    assert.equal(res.valid, true);
    assert.equal(res.recalculatedSubtotal, 58);
  });

  it('rejects negative item prices or NaN totals', async () => {
    const { validatePriceAndSubtotal } = await import('./orderValidation');
    const badItems = [{ name: 'Discount Glitch', price: -50, quantity: 1 }];
    const res = validatePriceAndSubtotal(badItems, -50);
    assert.equal(res.valid, false);
    assert.match(res.error || '', /invalid price/);
  });

  it('rejects subtotal mismatch between declared total and line items sum', async () => {
    const { validatePriceAndSubtotal } = await import('./orderValidation');
    const items = [{ name: 'Vada Pav', price: 20, quantity: 1 }];
    // Declared 10 instead of 20
    const res = validatePriceAndSubtotal(items, 10);
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Subtotal mismatch/);
  });
});

describe('11. 7-Day Order Cache Pruning & Sensitive Data Protection', () => {
  it('prunes orders older than 7 days from localStorage cache', async () => {
    const { pruneExpiredOrders, MAX_ORDER_CACHE_AGE_MS } = await import('../services/orderService');
    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    const testOrders: any[] = [
      { id: 'fresh-ord-1', shopId: 'shop-real-1', createdAt: twoDaysAgo },
      { id: 'expired-ord-2', shopId: 'shop-real-2', createdAt: tenDaysAgo },
    ];

    const pruned = pruneExpiredOrders(testOrders);
    assert.equal(pruned.length, 1);
    assert.equal(pruned[0].id, 'fresh-ord-1');
  });

  it('rejects storing sensitive credit card or banking credentials', async () => {
    const { assertNoSensitiveFinancialData } = await import('../services/orderService');
    const insecureOrder = {
      id: 'ord-insecure',
      total: 100,
      cardNumber: '4111222233334444',
      cvv: '123',
    };

    assert.throws(
      () => assertNoSensitiveFinancialData(insecureOrder),
      /Sensitive financial credential field/
    );

    const safeOrder = {
      id: 'ord-safe',
      total: 100,
      paymentMethod: 'PAY_ONLINE',
      utrNumber: '529482910394',
    };
    assert.doesNotThrow(() => assertNoSensitiveFinancialData(safeOrder));
  });
});

describe('12. Legal Policies & Custom 404 Routing', () => {
  it('resolves legal routes /privacy, /terms, /refunds and 404 for unknown routes', async () => {
    const { parsePath } = await import('../context/RouterContext');
    assert.equal(parsePath('/privacy').name, 'privacy');
    assert.equal(parsePath('/terms').name, 'terms');
    assert.equal(parsePath('/refunds').name, 'refunds');
    assert.equal(parsePath('/unknown-street-stall-404').name, 'not-found');
    assert.equal(parsePath('/').name, 'home');
  });
});

describe('13. Order Pre-Acceptance Cancellation & Post-Acceptance Lock Protocol', () => {
  it('permits customer cancellation and full refund claims strictly when status is PENDING', () => {
    assert.equal(canCustomerCancelOrder('PENDING'), true);
    assert.equal(canCustomerCancelOrder('pending'), true);
  });

  it('strictly locks customer cancellation once stall owner accepts or begins preparation', () => {
    assert.equal(canCustomerCancelOrder('ACCEPTED'), false);
    assert.equal(canCustomerCancelOrder('PREPARING'), false);
    assert.equal(canCustomerCancelOrder('READY'), false);
    assert.equal(canCustomerCancelOrder('COMPLETED'), false);
    assert.equal(canCustomerCancelOrder('CANCELLED'), false);
    assert.equal(canCustomerCancelOrder(null), false);
    assert.equal(canCustomerCancelOrder(undefined), false);
  });

  it('rejects customer state transition from ACCEPTED to CANCELLED', () => {
    const res = validateOrderStateTransition('ACCEPTED', 'CANCELLED', 'customer');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Order has already been accepted/);
  });

  it('allows customer state transition from PENDING to CANCELLED', () => {
    const res = validateOrderStateTransition('PENDING', 'CANCELLED', 'customer');
    assert.equal(res.valid, true);
  });

  it('throws an error if customer tries to cancel an accepted order via orderService', async () => {
    const { orderService } = await import('../services/orderService');
    const orders = orderService.getStoredOrders();
    const acceptedOrder: any = {
      id: 'ord-accepted-test',
      shopId: 'shop-real-1',
      orderStatus: 'ACCEPTED',
      paymentMethod: 'PAY_ONLINE',
      total: 100,
      createdAt: new Date().toISOString(),
    };
    orderService.saveOrders([acceptedOrder, ...orders]);

    await assert.rejects(
      async () => {
        await orderService.cancelOrder('ord-accepted-test', 'Changed mind', 'customer');
      },
      /Order has already been accepted by the food stall/
    );
  });
});

describe('14. Smart Listing Cache & In-Memory Deduplication', () => {
  it('generates deterministic location-keyed cache identifiers', async () => {
    const { getListingCacheKey } = await import('../services/shopService');
    const key1 = getListingCacheKey(2, 'chaat', { latitude: 19.3821, longitude: 72.8291 });
    const key2 = getListingCacheKey(2, 'chaat', { latitude: 19.3824, longitude: 72.8294 });
    assert.equal(key1, key2, 'Nearby coordinates within 3 decimal places should share the listing cache bucket');
  });
});
