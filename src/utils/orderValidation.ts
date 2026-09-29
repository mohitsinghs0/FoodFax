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
