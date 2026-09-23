import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { menuService } from '../../services/menuService';
import { shopService } from '../../services/shopService';
import { MenuItem, ShopCategory } from '../../types';
import { ArrowLeft, UtensilsCrossed, AlertCircle, Sparkles } from 'lucide-react';

export const BusinessItemFormView: React.FC = () => {
  const { route, navigate, goBack } = useRouter();
  const { currentBusiness, activeShopId } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const itemId = route.params?.itemId;
  const isEditing = Boolean(itemId && itemId !== 'new');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | string>(50);
  const [categoryId, setCategoryId] = useState('street-food');
  const [isVeg, setIsVeg] = useState(true);
  const [isBestseller, setIsBestseller] = useState(false);
  const [prepTimeMin, setPrepTimeMin] = useState(5);
  const [image, setImage] = useState('https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80');
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const cats = await shopService.getCategories();
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);

        if (isEditing && itemId) {
          const items = await menuService.getMenuItems(targetShopId);
          const found = items.find((i) => i.id === itemId);
          if (found) {
            setName(found.name);
            setDescription(found.description);
            setPrice(found.price);
            setCategoryId(found.categoryId);
            setIsVeg(found.isVeg);
            setIsBestseller(Boolean(found.isBestseller));
            setPrepTimeMin(found.preparationTimeMin || 5);
            setImage(found.image);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [itemId, isEditing, targetShopId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      setError('Item name and price are required.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      if (isEditing && itemId) {
        await menuService.updateMenuItem(itemId, {
          name: name.trim(),
          description: description.trim(),
          price: Number(price),
          categoryId,
          isVeg,
          isBestseller,
          preparationTimeMin: Number(prepTimeMin),
          image,
        });
      } else {
        await menuService.addMenuItem({
          shopId: targetShopId,
          categoryId,
          name: name.trim(),
          description: description.trim(),
          price: Number(price),
          image,
          isAvailable: true,
          isVeg,
          isBestseller,
          preparationTimeMin: Number(prepTimeMin),
        });
      }
      navigate('/business/menu');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save menu item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BusinessLayout activeTab="menu" showBackButton onBack={goBack}>
      <div className="max-w-xl mx-auto space-y-5 pb-20">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              {isEditing ? 'Edit Menu Dish' : 'Add New Menu Item'}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing ? 'Update price, image or preparation details' : 'Publish a new item to your counter stall'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Dish Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Schezwan Fried Rice, Butter Vada Pav"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Prep Time (Mins)</label>
              <input
                type="number"
                value={prepTimeMin}
                onChange={(e) => setPrepTimeMin(Number(e.target.value))}
                min="1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Crispy fried potato dumpling in toasted pav with dry garlic chutney"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsVeg(!isVeg)}
              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                isVeg ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-rose-50 border-rose-500 text-rose-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
              <span>{isVeg ? 'Pure Veg' : 'Non-Veg'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBestseller(!isBestseller)}
              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                isBestseller
                  ? 'bg-amber-50 border-amber-500 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Bestseller / Tag</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Image URL</label>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Dish' : 'Publish to Menu'}
          </button>
        </form>
      </div>
    </BusinessLayout>
  );
};
