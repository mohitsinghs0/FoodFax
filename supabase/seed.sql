-- ============================================================================
-- FoodFax — Database Seed / Backup Data
-- Run this in Supabase SQL Editor after running schema.sql
-- ============================================================================

-- 1. SEED CATEGORIES
INSERT INTO public.categories (id, name, icon_name, description, display_order, is_active)
VALUES
  ('cat-1', 'Vada Pav & Chaat', 'Utensils', 'Authentic Mumbai street snacks and crispy fried favorites', 1, true),
  ('cat-2', 'Chai & Beverages', 'Coffee', 'Kadak adrak chai, filter coffee, coolers & fresh juices', 2, true),
  ('cat-3', 'Rolls & Fast Food', 'Flame', 'Quick rolls, frankies, sandwiches and noodles', 3, true),
  ('cat-4', 'Thali & Meals', 'ShoppingBag', 'Quick executive meals, tiffin rice plates & combos', 4, true),
  ('cat-5', 'Desserts & Shakes', 'Smile', 'Sweet treats, faloodas, kulfis & thick shakes', 5, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon_name = EXCLUDED.icon_name,
  description = EXCLUDED.description;

-- 2. SEED SHOPS
INSERT INTO public.shops (
  id, name, slug, stall_type, tagline, description, image, banner_image,
  phone, contact_phone, address, area, city, state, pincode,
  latitude, longitude, upi_id, opening_time, closing_time, opening_hours,
  is_open, is_active, is_pure_veg, rating, total_reviews, preparation_time_minutes,
  featured_item, categories, is_demo
) VALUES
  (
    'sharma-vada-pav',
    'Sharma Vada Pav',
    'sharma-vada-pav',
    'Thela / Food Stall',
    'Mumbai''s crunchiest vada pav with hot lasun chutney',
    'Serving authentic batata vada pav, crispy samosa pav and cutting chai right outside the metro station since 2012.',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
    '+91 98200 12345',
    '+91 98200 12345',
    'Gate 2, Andheri West Metro Station, Mumbai',
    'Andheri West',
    'Mumbai',
    'Maharashtra',
    '400058',
    19.1197,
    72.8464,
    'sharma.vadapav@okaxis',
    '08:00 AM',
    '10:30 PM',
    '08:00 AM – 10:30 PM',
    true,
    true,
    true,
    4.8,
    412,
    '3–7',
    'Ulta Vada Pav Supreme',
    ARRAY['fast-food', 'snacks']::TEXT[],
    false
  ),
  (
    'deepak-chinese-corner',
    'Deepak Chinese Corner',
    'deepak-chinese-corner',
    'Fast Food Counter',
    'Authentic Wok Noodles, Crispy Manchurian & Schezwan',
    'Special Veg Hakka Noodles, Manchurian & Schezwan fast food counter cooked on roaring high-flame woks.',
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=1200&q=80',
    '+91 93214 44296',
    '+91 93214 44296',
    'Shop No. 4, Station Road, Naigaon East, Mumbai',
    'Naigaon East',
    'Mumbai Suburban',
    'Maharashtra',
    '401208',
    19.3515,
    72.8525,
    'deepak.chinese@upi',
    '11:00 AM',
    '11:00 PM',
    '11:00 AM – 11:00 PM',
    true,
    true,
    true,
    4.9,
    184,
    '5–10',
    'Special Veg Hakka Noodles',
    ARRAY['fast-food', 'chinese']::TEXT[],
    false
  ),
  (
    'tapri-tea-house',
    'Gupta Chai & Bun Maska Tapri',
    'tapri-tea-house',
    'Tea Tapri',
    'Ginger Elaichi Chai & Toasted Maska Pav',
    'Classic Mumbai street tapri offering boiling hot masala ginger chai, maska pav, khari and cream rolls.',
    'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=80',
    '+91 98330 99881',
    '+91 98330 99881',
    'Near Mithibai College, Vile Parle West, Mumbai',
    'Vile Parle West',
    'Mumbai',
    'Maharashtra',
    '400056',
    19.1026,
    72.8362,
    'guptachai@ybl',
    '06:30 AM',
    '11:00 PM',
    '06:30 AM – 11:00 PM',
    true,
    true,
    true,
    4.7,
    520,
    '2–5',
    'Special Adrak Masala Chai',
    ARRAY['chai', 'snacks']::TEXT[],
    false
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  upi_id = EXCLUDED.upi_id;

-- 3. SEED MENU ITEMS FOR SHARMA VADA PAV
INSERT INTO public.menu_items (
  id, shop_id, category_id, name, description, price, image, is_veg, is_available, is_bestseller, preparation_time_min, preparation_minutes
) VALUES
  ('svp-01', 'sharma-vada-pav', 'cat-1', 'Classic Mumbai Vada Pav', 'Crispy spiced potato dumpling nestled in fresh pav with fiery garlic chutney & fried green chilli', 20.00, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80', true, true, true, 3, '2-4'),
  ('svp-02', 'sharma-vada-pav', 'cat-1', 'Cheese burst Vada Pav', 'Loaded with molten processed cheese and spicy mint coriander sauce inside freshly toasted pav', 45.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80', true, true, true, 4, '3-5'),
  ('svp-03', 'sharma-vada-pav', 'cat-1', 'Crispy Punjabi Samosa Pav', 'Crispy golden triangular samosa filled with spiced potato-pea stuffing served in soft buttered pav', 25.00, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80', true, true, false, 3, '2-4'),
  ('svp-04', 'sharma-vada-pav', 'cat-2', 'Cutting Adrak Chai', 'Freshly brewed aromatic ginger and cardamom cutting tea with milk', 15.00, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=500&q=80', true, true, true, 2, '1-3'),

  -- DEEPAK CHINESE CORNER ITEMS
  ('dcc-01', 'deepak-chinese-corner', 'cat-3', 'Veg Hakka Noodles', 'Wok tossed noodles with shredded cabbage, capsicum, carrots, scallions and aromatic soy glaze', 90.00, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=500&q=80', true, true, true, 7, '5-8'),
  ('dcc-02', 'deepak-chinese-corner', 'cat-3', 'Veg Manchurian Dry (8 Pcs)', 'Crispy vegetable dumplings tossed in garlic, ginger, coriander and spicy dark soya sauce', 100.00, 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=500&q=80', true, true, true, 8, '6-10'),
  ('dcc-03', 'deepak-chinese-corner', 'cat-3', 'Schezwan Fried Rice', 'Spicy basmati wok rice seasoned with home-crafted red pepper Schezwan sauce and fresh spring onions', 95.00, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=500&q=80', true, true, false, 8, '6-10')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  is_available = EXCLUDED.is_available;
