import DOMPurify from 'dompurify';

/**
 * Order Validation Utilities
 */

export interface ValidatableOrderItem {
  id?: string;
  name?: string;
  price: number;
  quantity: number;
  isVeg?: boolean;
}

export interface ValidatableOrder {
  items?: ValidatableOrderItem[];
  total?: number;
  subtotal?: number;
  [key: string]: any;
}

export function assertValidOrderSubmission(order: ValidatableOrder): void {
  if (!order) {
    throw new Error('Order submission payload is missing or undefined.');
  }

  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    throw new Error('Order must contain at least one item.');
  }

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      throw new Error(`Order item at index ${i} is missing a valid name.`);
    }

    if (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0) {
      throw new Error(`Order item "${item.name}" has an invalid price: ${item.price}`);
    }

    if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
      throw new Error(`Order item "${item.name}" has an invalid quantity: ${item.quantity}`);
    }
  }

  if (typeof order.total === 'number') {
    if (isNaN(order.total) || order.total < 0) {
      throw new Error(`Order total is invalid: ${order.total}`);
    }

    const calculatedSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Allow small rounding or delivery adjustments, but flag negative
    if (order.total <= 0 && calculatedSubtotal > 0) {
      throw new Error(`Order total (${order.total}) does not match items sum (${calculatedSubtotal}).`);
    }
  }
}

export function calculateOrderSubtotal(items: ValidatableOrderItem[]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
}

/**
 * Validates a 12-digit NPCI UPI Reference / UTR (Retrieval Reference Number).
 * Blocks non-numeric strings, wrong lengths, sequential numbers, and repetitive fake patterns.
 */
export function validateUpiUtr(rawUtr: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const cleaned = (rawUtr || '').replace(/\s+/g, '').trim();

  if (!cleaned) {
    return {
      valid: false,
      cleaned,
      error: 'Please enter the 12-digit UPI Reference / UTR number from your payment app.',
    };
  }

  if (!/^[0-9]{12}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR format. UPI UTR / Reference number must be strictly 12 numeric digits (0-9).',
    };
  }

  // NPCI RRN / UTR numbers never start with 0
  if (cleaned.startsWith('0')) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UPI UTR number. A valid bank UTR never starts with 0.',
    };
  }

  // Block identical digits or 6+ consecutive identical digits (e.g. 111111111111, 499999991234)
  if (/(\d)\1{5,}/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR number detected. Repetitive dummy digits are not allowed.',
    };
  }

  // Require at least 4 distinct digits across the 12-digit RRN
  const uniqueDigits = new Set(cleaned.split('')).size;
  if (uniqueDigits < 4) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR number detected. Please enter the real 12-digit UTR from GPay / PhonePe / Paytm.',
    };
  }

  // Block repeating patterns like 121212121212, 123123123123, 123412341234, 123456123456
  if (/^(\d{2,6})\1+$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR number. Repeating number patterns are blocked.',
    };
  }

  // Block sequential patterns (ascending or descending 6+ digits)
  const sequences = [
    '012345', '123456', '234567', '345678', '456789', '567890',
    '987654', '876543', '765432', '654321', '543210',
  ];
  for (const seq of sequences) {
    if (cleaned.includes(seq)) {
      return {
        valid: false,
        cleaned,
        error: 'Invalid UTR number. Sequential test numbers (e.g. 123456...) are blocked.',
      };
    }
  }

  return { valid: true, cleaned };
}

/**
 * Determines whether a customer is eligible to cancel an order and claim a full refund.
 * RULE: Customers can cancel and claim 100% full refund ONLY when the order is PENDING (before shop acceptance).
 * Once the shop owner accepts the order (ACCEPTED / PREPARING / READY / COMPLETED), cancellations and refunds
 * are strictly not permitted because food preparation has commenced.
 */
export function canCustomerCancelOrder(orderStatus: string | undefined | null): boolean {
  if (!orderStatus) return false;
  return String(orderStatus).trim().toUpperCase() === 'PENDING';
}

/**
 * Validates sequential order fulfillment state transitions.
 * Allowed sequence: PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED.
 * Cancellations/Rejections allowed from PENDING.
 * Once accepted by shop, customer cancellation is strictly locked.
 */
export const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'CANCELLED', 'REJECTED'], // Shop/admin can cancel/reject if out of stock
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function validateOrderStateTransition(
  currentStatus: string,
  newStatus: string,
  initiator: 'customer' | 'shop' | 'admin' = 'shop'
): { valid: boolean; error?: string } {
  const current = String(currentStatus || '').toUpperCase();
  const next = String(newStatus || '').toUpperCase();

  if (current === next) {
    return { valid: true };
  }

  // Customer cancellation lock: only permitted while PENDING (pre-acceptance)
  if (next === 'CANCELLED' && initiator === 'customer') {
    if (current !== 'PENDING') {
      return {
        valid: false,
        error: `Order has already been accepted by the food stall (${current}). Cancellations and refunds are no longer permitted once food preparation begins.`,
      };
    }
  }

  const allowed = VALID_ORDER_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      error: `Invalid state transition from ${current} to ${next}. Allowed next states: ${
        allowed.length > 0 ? allowed.join(', ') : 'None (Terminal state)'
      }.`,
    };
  }

  return { valid: true };
}

/**
 * Sanitizes input text using DOMPurify and entity normalization:
 * strips HTML tags, script injections, javascript: schemes, and excessive whitespace.
 */
export function sanitizeTextInput(input: string | undefined | null, maxLength = 250): string {
  if (!input) return '';
  let raw = String(input);

  // If running in browser DOM environment, run through DOMPurify first
  try {
    if (typeof window !== 'undefined') {
      const purify: any = (DOMPurify as any)?.sanitize
        ? DOMPurify
        : typeof (DOMPurify as any) === 'function'
          ? (DOMPurify as any)(window)
          : null;
      if (purify && typeof purify.sanitize === 'function') {
        raw = purify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
      }
    }
  } catch {}

  const noHtml = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
  return noHtml.slice(0, maxLength);
}

/**
 * Bot trap honeypot detector.
 * Returns true if the invisible bot_trap field is filled with content.
 */
export function isBotDetected(botTrapValue?: string | null): boolean {
  return Boolean(botTrapValue && typeof botTrapValue === 'string' && botTrapValue.trim().length > 0);
}

/**
 * Validates price and recalculates item subtotals client-side before triggering payment.
 * Disallows negative prices, invalid quantities, or NaN totals.
 */
export function validatePriceAndSubtotal(
  items: Array<{ price?: number; quantity?: number; name?: string }>,
  declaredSubtotal?: number
): { valid: boolean; error?: string; recalculatedSubtotal: number } {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Cart is empty. Please add items from a food stall.', recalculatedSubtotal: 0 };
  }

  let calculated = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const price = Number(item.price);
    const qty = Number(item.quantity);

    if (isNaN(price) || price < 0) {
      return {
        valid: false,
        error: `Item "${item.name || `Item ${i + 1}`}" has an invalid price: ₹${item.price}`,
        recalculatedSubtotal: 0,
      };
    }
    if (isNaN(qty) || qty <= 0) {
      return {
        valid: false,
        error: `Item "${item.name || `Item ${i + 1}`}" has an invalid quantity: ${item.quantity}`,
        recalculatedSubtotal: 0,
      };
    }

    calculated += price * qty;
  }

  // Round to 2 decimal places to avoid floating point precision quirks
  calculated = Math.round(calculated * 100) / 100;

  if (declaredSubtotal !== undefined) {
    const declared = Number(declaredSubtotal);
    if (isNaN(declared) || declared < 0) {
      return {
        valid: false,
        error: `Declared subtotal is invalid: ₹${declaredSubtotal}`,
        recalculatedSubtotal: calculated,
      };
    }
    // Disallow mismatch between declared subtotal and recalculated item sum
    if (Math.abs(declared - calculated) > 1.0) {
      return {
        valid: false,
        error: `Subtotal mismatch: cart subtotal (₹${declared}) does not match item sum (₹${calculated}).`,
        recalculatedSubtotal: calculated,
      };
    }
  }

  return { valid: true, recalculatedSubtotal: calculated };
}

/**
 * Masks customer phone number for display (e.g. +91 95551 *****) to preserve PII privacy.
 */
export function maskPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 8) return '****';
  const prefix = clean.slice(0, clean.length - 5);
  return `${prefix}*****`;
}

/**
 * Customer session order authorization tracker (prevents IDOR on /order/:id)
 */
const RECENT_ORDERS_KEY = 'foodfax_my_order_ids';

export function recordPlacedOrder(orderId: string): void {
  if (typeof window === 'undefined' || !orderId) return;
  try {
    const raw = localStorage.getItem(RECENT_ORDERS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(orderId)) {
      ids.unshift(orderId);
      localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(ids.slice(0, 50)));
    }
  } catch {}
}

export function isCustomerAuthorizedForOrder(
  order: { id: string; customerId?: string; customerPhone?: string },
  currentUser: { id?: string; phone?: string; role?: string } | null
): boolean {
  if (!order) return false;
  // Admins always have access
  if (currentUser?.role === 'admin') return true;

  // Direct user ID match
  if (currentUser?.id && order.customerId && currentUser.id === order.customerId) {
    return true;
  }

  // Clean phone number match
  if (currentUser?.phone && order.customerPhone) {
    const uPhone = currentUser.phone.replace(/\D/g, '').slice(-10);
    const oPhone = order.customerPhone.replace(/\D/g, '').slice(-10);
    if (uPhone && uPhone === oPhone) return true;
  }

  // Placed on this device/browser in active customer session
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(RECENT_ORDERS_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (ids.includes(order.id)) return true;
    } catch {}
  }

  return false;
}

/**
 * Platform Merchant UPI Invariants & Canonical Deep Link Generators
 */
export const PLATFORM_UPI_ID = 'bharatpe2e0p0d8x5a59798@unitype';
export const PLATFORM_MERCHANT_NAME = 'Mohit Santosh Singh';

export interface CanonicalUpiParams {
  pa: string;
  pn: string;
  am: number | string;
  tr: string;
  tn: string;
}

/**
 * Builds standard NPCI-compliant UPI URI with strict RFC 3986 percent-encoding (%20 instead of +).
 * Plus (+) characters in payee name or note cause Google Pay "Could not load banking name" failures.
 */
export function buildCanonicalUpiUri(params: CanonicalUpiParams): string {
  const pa = String(params.pa || PLATFORM_UPI_ID).trim();
  const pn = String(params.pn || PLATFORM_MERCHANT_NAME).trim();
  const am = Number(params.am || 0).toFixed(2);
  const tr = String(params.tr || '').trim();
  const tn = String(params.tn || `FoodFax Order ${tr}`).trim();

  const queryParts = [
    `pa=${encodeURIComponent(pa)}`,
    `pn=${encodeURIComponent(pn)}`,
    `am=${am}`,
    'cu=INR',
    `tn=${encodeURIComponent(tn)}`,
    `tr=${encodeURIComponent(tr)}`,
  ];

  return `upi://pay?${queryParts.join('&')}`;
}

export function buildTezGpayUri(params: CanonicalUpiParams): string {
  const base = buildCanonicalUpiUri(params);
  return base.replace(/^upi:\/\/pay\?/, 'tez://upi/pay?');
}

export function buildPhonePeUri(params: CanonicalUpiParams): string {
  const base = buildCanonicalUpiUri(params);
  return base.replace(/^upi:\/\/pay\?/, 'phonepe://pay?');
}

export function buildPaytmUri(params: CanonicalUpiParams): string {
  const base = buildCanonicalUpiUri(params);
  return base.replace(/^upi:\/\/pay\?/, 'paytmmp://pay?');
}

/**
 * Normalizes gateway and webhook payment statuses into canonical FoodFax states.
 */
export function normalizePaymentStatus(rawStatus?: string | null): 'WAITING' | 'PAID' | 'REJECTED' | 'EXPIRED' {
  const normalized = String(rawStatus || '').toLowerCase().trim();
  if (['success', 'paid', 'completed'].includes(normalized)) {
    return 'PAID';
  }
  if (['failed', 'rejected', 'error', 'declined'].includes(normalized)) {
    return 'REJECTED';
  }
  if (['expired', 'timedout'].includes(normalized)) {
    return 'EXPIRED';
  }
  return 'WAITING';
}

/**
 * Sanitizes gateway order creation response to guarantee customer always pays
 * the verified platform merchant (Mohit Santosh Singh / BharatPe) and prevents
 * third-party aliases like "FoodAds" with missing bank registrations from breaking Google Pay.
 */
export function sanitizeCheckoutUpiData(
  currentData: {
    paymentId: string;
    orderId: string;
    amount: number;
    qrCode: string;
    upiLink: string;
    payUrl?: string;
    expiresAt: string;
    status: string;
  },
  gatewayResponse: any,
  originalGrandTotal: number
): {
  paymentId: string;
  orderId: string;
  amount: number;
  qrCode: string;
  upiLink: string;
  payUrl?: string;
  expiresAt: string;
  status: string;
} {
  return {
    ...currentData,
    paymentId: gatewayResponse?.paymentId || gatewayResponse?.payment_id || currentData.paymentId,
    // Preserve canonical platform QR code & UPI links to avoid third-party "FoodAds" errors
    qrCode: currentData.qrCode,
    upiLink: currentData.upiLink,
    payUrl: currentData.payUrl,
    expiresAt: gatewayResponse?.expires_at || gatewayResponse?.expiresAt || currentData.expiresAt,
    status: gatewayResponse?.status || currentData.status,
    amount: originalGrandTotal,
  };
}


