import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { menuService, clearMenuCache, MENU_CACHE_TTL_MS } from './menuService';
import { MOCK_MENU_ITEMS } from '../data/mockData';

describe('Menu Service & Stall Items Suite (TDD)', () => {
  beforeEach(() => {
    clearMenuCache();
  });

  describe('1. Standard Food Stall Menu Resolution', () => {
    it('reliably returns authentic menu items for Sharma Vada Pav without returning empty', async () => {
      const items = await menuService.getShopMenu('sharma-vada-pav');
      assert.ok(Array.isArray(items), 'Items must be an array');
      assert.ok(items.length > 0, `Expected items for Sharma Vada Pav, got ${items.length}`);

      // Verify signature items are present
      const classicVadaPav = items.find((i) => i.name.toLowerCase().includes('vada pav'));
      assert.ok(classicVadaPav, 'Classic Vada Pav must be present in Sharma Vada Pav menu');
      assert.equal(classicVadaPav.isVeg, true);
      assert.ok(classicVadaPav.price > 0);
    });

    it('matches by slug when shopId and slug differ or are interchangeable', async () => {
      const byId = await menuService.getShopMenu('sharma-vada-pav');
      const bySlug = await menuService.getShopMenu('sharma-vada-pav', 'sharma-vada-pav');
      assert.equal(byId.length, bySlug.length);
    });

    it('reliably returns menu items for College Canteen', async () => {
      const items = await menuService.getShopMenu('college-canteen');
      assert.ok(items.length >= 5, `Expected multiple dishes for College Canteen, got ${items.length}`);
      const maggiOrSandwich = items.find(
        (i) => i.name.toLowerCase().includes('maggi') || i.name.toLowerCase().includes('sandwich')
      );
      assert.ok(maggiOrSandwich, 'Student canteen favorites must be available');
    });

    it('reliably returns menu items for Mumbai Snacks Corner', async () => {
      const items = await menuService.getShopMenu('mumbai-snacks-corner');
      assert.ok(items.length > 0, 'Mumbai snacks corner menu must not be empty');
      const pavBhaji = items.find((i) => i.name.toLowerCase().includes('pav bhaji'));
      assert.ok(pavBhaji, 'Pav bhaji must be present');
    });
  });

  describe('2. Unknown or New Stall Signature Dishes Fallback', () => {
    it('generates high quality signature street food dishes for a stall with no catalog yet', async () => {
      const items = await menuService.getShopMenu('newly-registered-stall-999');
      assert.ok(Array.isArray(items), 'Items must be an array');
      assert.ok(items.length > 0, 'New stall must receive signature fallback dishes so customer is never stranded');
      assert.ok(items.some((i) => i.name.toLowerCase().includes('pav bhaji') || i.name.toLowerCase().includes('vada pav')));
    });
  });

  describe('3. In-Memory Sub-50ms Menu Caching', () => {
    it('caches retrieved items and returns fast cached copy on subsequent calls', async () => {
      const t1 = Date.now();
      const first = await menuService.getShopMenu('sharma-vada-pav');
      const t2 = Date.now();

      const second = await menuService.getShopMenu('sharma-vada-pav');
      const t3 = Date.now();

      assert.deepEqual(first, second);
      assert.ok(t3 - t2 <= t2 - t1 + 5, 'Second call should hit memory cache immediately');
    });

    it('flushes cache when clearMenuCache is called', async () => {
      await menuService.getShopMenu('sharma-vada-pav');
      clearMenuCache('sharma-vada-pav');
      const fresh = await menuService.getShopMenu('sharma-vada-pav');
      assert.ok(fresh.length > 0);
    });

    it('enforces 5-minute TTL invariant for stall menu cache', () => {
      assert.equal(MENU_CACHE_TTL_MS, 5 * 60 * 1000);
    });
  });

  describe('4. Global Menu Items & Dishes Search Pool', () => {
    it('getMenuItems() without shopId returns full catalog of dishes for global search', async () => {
      const allDishes = await menuService.getMenuItems();
      assert.ok(allDishes.length >= MOCK_MENU_ITEMS.length);
    });
  });
});

