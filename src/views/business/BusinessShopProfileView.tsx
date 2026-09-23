import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BusinessLayout } from '../../components/business/BusinessLayout';
import { shopService } from '../../services/shopService';
import { Shop, StallType } from '../../types';
import { Store, MapPin, Clock, Phone, AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { GPSLocationPicker } from '../../components/common/GPSLocationPicker';

const STALL_TYPES: StallType[] = [
  'Thela / Food Stall',
  'College Canteen',
  'Tea Tapri',
  'Fast Food Counter',
  'Sandwich Cart',
  'Juice Point',
  'Chaat Cart',
  'Tiffin Cart',
];

export const BusinessShopProfileView: React.FC = () => {
  const { currentBusiness, activeShopId } = useAuth();
  const targetShopId = activeShopId || currentBusiness?.id || 'demo-shop-001';

  const [shop, setShop] = useState<Shop | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [stallType, setStallType] = useState<StallType>('Thela / Food Stall');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number>(19.3515);
  const [longitude, setLongitude] = useState<number>(72.8525);
  const [openingHours, setOpeningHours] = useState('');
  const [upiId, setUpiId] = useState('');
  const [image, setImage] = useState('');
  const [isPureVeg, setIsPureVeg] = useState(false);
  const [prepTime, setPrepTime] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const s = await shopService.getShop(targetShopId);
        if (s) {
          setShop(s);
          setName(s.name);
          setTagline(s.tagline || '');
          setDescription(s.description || '');
          setStallType(s.stallType);
          setContactPhone(s.contactPhone || '');
          setAddress(s.location.address);
          setLatitude(s.location?.latitude || s.latitude || 19.3515);
          setLongitude(s.location?.longitude || s.longitude || 72.8525);
          setOpeningHours(s.openingHours || '');
          setUpiId(s.upiId || '');
          setImage(s.image);
          setIsPureVeg(s.isPureVeg);
          setPrepTime(parseInt(s.preparationTimeMinutes, 10) || 10);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [targetShopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    setSaving(true);
    setSavedSuccess(false);
    try {
      const updated = await shopService.updateShop(shop.id, {
        name,
        tagline,
        description,
        stallType,
        contactPhone,
        openingHours,
        upiId,
        image,
        isPureVeg,
        preparationTimeMinutes: String(prepTime),
        latitude: Number(latitude),
        longitude: Number(longitude),
        location: {
          ...shop.location,
          address,
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
      });
      setShop(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BusinessLayout activeTab="profile">
      <div className="max-w-xl mx-auto space-y-5 pb-20">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" />
            Stall Counter Profile
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your public stall branding, hours, UPI ID, and contact details
          </p>
        </div>

        {savedSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Stall Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Stall Type</label>
              <select
                value={stallType}
                onChange={(e) => setStallType(e.target.value as StallType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white"
              >
                {STALL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address / Landmark</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* GPS Live Location & Map Pinpoint Section */}
          <GPSLocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={({ latitude: newLat, longitude: newLng }) => {
              setLatitude(newLat);
              setLongitude(newLng);
            }}
            title="Stall Live GPS Coordinates & Map Pin"
            subtitle="Pinpoint your live stall counter position so customers can easily navigate and see exact distance."
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Opening Hours</label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="08:00 AM - 10:00 PM"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Avg Prep Time (Mins)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Stall UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="stallowner@okaxis"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Stall Photo URL</label>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsPureVeg(!isPureVeg)}
              className={`w-full p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                isPureVeg
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isPureVeg ? 'bg-emerald-600' : 'bg-slate-300'}`} />
              <span>Mark this stall as 100% Pure Vegetarian</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </form>
      </div>
    </BusinessLayout>
  );
};
