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
 * Validates sequential order fulfillment state transitions.
 * Allowed sequence: PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED.
 * Cancellations/Rejections allowed from PENDING, ACCEPTED, or PREPARING.
 * Disallows invalid jumps (e.g., PENDING directly to COMPLETED).
 */
export const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'CANCELLED', 'REJECTED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function validateOrderStateTransition(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: string } {
  const current = String(currentStatus || '').toUpperCase();
  const next = String(newStatus || '').toUpperCase();

  if (current === next) {
    return { valid: true };
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
 * Sanitizes input text: strips HTML tags, script injections, and excessive whitespace.
 */
export function sanitizeTextInput(input: string | undefined | null, maxLength = 250): string {
  if (!input) return '';
  const noHtml = String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
  return noHtml.slice(0, maxLength);
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

