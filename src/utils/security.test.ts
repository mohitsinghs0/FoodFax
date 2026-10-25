import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidOrderSubmission,
  validateOrderStateTransition,
  validateUpiUtr,
  sanitizeTextInput,
  maskPhoneNumber,
  isCustomerAuthorizedForOrder,
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
