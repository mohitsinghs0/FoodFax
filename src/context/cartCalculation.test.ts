import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CartItem, MenuItem, Shop } from '../types';

/**
 * Pure cart domain functions matching CartContext rules
 */
export function calculateCartSummary(items: CartItem[]): { totalItems: number; subtotal: number } {
  if (!items || !Array.isArray(items)) {
    return { totalItems: 0, subtotal: 0 };
  }

  const totalItems = items.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const rawSubtotal = items.reduce(
    (acc, curr) => acc + (curr.menuItem?.price || 0) * (curr.quantity || 0),
    0
  );
  // Round to 2 decimal places to prevent floating point quirks
  const subtotal = Math.round(rawSubtotal * 100) / 100;

  return { totalItems, subtotal };
}

export function evaluateCartShopConflict(
  currentShopId: string | null,
  currentItemsCount: number,
  newShopId: string
): { hasConflict: boolean } {
  if (currentShopId && currentItemsCount > 0 && currentShopId !== newShopId) {
    return { hasConflict: true };
  }
  return { hasConflict: false };
}

export function updateItemInCart(
  items: CartItem[],
  targetItemId: string,
  delta: number
): CartItem[] {
  return items
    .map((item) => {
      if (item.menuItem.id === targetItemId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    })
    .filter((item): item is CartItem => item !== null);
}

describe('Cart Calculations & Single-Stall Invariants (TDD)', () => {
  const shopA: Shop = {
    id: 'shop-sharma-vada-pav',
    name: 'Sharma Vada Pav',
    slug: 'sharma-vada-pav',
    image: 'https://images.unsplash.com/photo-1',
    rating: 4.8,
    categories: ['Vada Pav'],
    address: 'Near Dadar Station, Mumbai',
    isOpen: true,
    latitude: 19.0178,
    longitude: 72.8478,
  } as Shop;

  const item1: MenuItem = {
    id: 'item-1',
    shopId: 'shop-sharma-vada-pav',
    categoryId: 'cat-vada-pav',
    name: 'Classic Batata Vada',
    description: 'Hot spiced potato patty',
    price: 20,
    image: 'https://images.unsplash.com/photo-1',
    isAvailable: true,
    isVeg: true,
  };

  const item2: MenuItem = {
    id: 'item-2',
    shopId: 'shop-sharma-vada-pav',
    categoryId: 'cat-vada-pav',
    name: 'Cheese Grilled Vada Pav',
    description: 'Grilled with mozzarella',
    price: 45.5,
    image: 'https://images.unsplash.com/photo-2',
    isAvailable: true,
    isVeg: true,
  };

  describe('1. Cart Totals & Precision Calculations', () => {
    it('computes accurate totals for empty cart', () => {
      const summary = calculateCartSummary([]);
      assert.equal(summary.totalItems, 0);
      assert.equal(summary.subtotal, 0);
    });

    it('computes correct item count and subtotal for multiple items', () => {
      const cartItems: CartItem[] = [
        { menuItem: item1, quantity: 2, shopId: shopA.id }, // 2 * 20 = 40
        { menuItem: item2, quantity: 3, shopId: shopA.id }, // 3 * 45.50 = 136.50
      ];

      const summary = calculateCartSummary(cartItems);
      assert.equal(summary.totalItems, 5);
      assert.equal(summary.subtotal, 176.5);
    });

    it('prevents floating point inaccuracies (e.g. 0.1 + 0.2 decimal sums)', () => {
      const itemOdd: MenuItem = {
        id: 'odd-1',
        shopId: shopA.id,
        categoryId: 'cat-chai',
        name: 'Chai',
        description: 'Masala Cutting Chai',
        price: 12.33,
        image: 'https://images.unsplash.com/photo-chai',
        isAvailable: true,
        isVeg: true,
      };
      const cartItems: CartItem[] = [
        { menuItem: itemOdd, quantity: 3, shopId: shopA.id }, // 3 * 12.33 = 36.99
      ];

      const summary = calculateCartSummary(cartItems);
      assert.equal(summary.subtotal, 36.99);
    });
  });

  describe('2. Single-Stall Cart Restriction (Cross-Stall Isolation)', () => {
    it('detects conflict when adding item from different shop with existing items', () => {
      const conflict = evaluateCartShopConflict('shop-sharma-vada-pav', 2, 'shop-delhi-chaat');
      assert.equal(conflict.hasConflict, true);
    });

    it('allows adding item from the same shop without conflict', () => {
      const conflict = evaluateCartShopConflict('shop-sharma-vada-pav', 2, 'shop-sharma-vada-pav');
      assert.equal(conflict.hasConflict, false);
    });

    it('allows adding item from any shop if cart is currently empty', () => {
      const conflict = evaluateCartShopConflict('shop-sharma-vada-pav', 0, 'shop-delhi-chaat');
      assert.equal(conflict.hasConflict, false);
    });
  });

  describe('3. Quantity Delta and Item Eviction', () => {
    it('increments item quantity accurately', () => {
      const initial: CartItem[] = [{ menuItem: item1, quantity: 1, shopId: shopA.id }];
      const updated = updateItemInCart(initial, 'item-1', 2);
      assert.equal(updated.length, 1);
      assert.equal(updated[0].quantity, 3);
    });

    it('decrements item quantity and removes when reaching zero', () => {
      const initial: CartItem[] = [
        { menuItem: item1, quantity: 2, shopId: shopA.id },
        { menuItem: item2, quantity: 1, shopId: shopA.id },
      ];

      // Decrement item1 by 1 -> remaining 1
      const step1 = updateItemInCart(initial, 'item-1', -1);
      assert.equal(step1.find((i) => i.menuItem.id === 'item-1')?.quantity, 1);

      // Decrement item2 by 1 -> reaching 0, must be evicted
      const step2 = updateItemInCart(step1, 'item-2', -1);
      assert.equal(step2.length, 1);
      assert.equal(step2.find((i) => i.menuItem.id === 'item-2'), undefined);
    });
  });
});
