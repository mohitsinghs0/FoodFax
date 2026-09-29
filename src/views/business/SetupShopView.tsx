import React, { useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { StallType } from '../../types';
import { Store, MapPin, Clock, QrCode, Phone, AlertCircle, ArrowRight } from 'lucide-react';
import { GPSLocationPicker } from '../../components/common/GPSLocationPicker';

const STALL_OPTIONS: StallType[] = [
  'Thela / Food Stall',
  'College Canteen',
  'Tea Tapri',
  'Fast Food Counter',
  'Sandwich Cart',
  'Juice Point',
  'Chaat Cart',
  'Tiffin Cart',
];

export const SetupShopView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser, setupOwnerShop } = useAuth();

  const [ownerName, setOwnerName] = useState(currentUser?.fullName || currentUser?.name || 'Stall Owner');
  const [shopName, setShopName] = useState('');
  const [stallType, setStallType] = useState<StallType>('Thela / Food Stall');
  const [description, setDescription] = useState('Freshly made authentic street food');
  const [phone, setPhone] = useState(currentUser?.phone || '+91 98200 12345');
  const [address, setAddress] = useState('Near Station Road');
  const [area, setArea] = useState('Naigaon East');
  const [city, setCity] = useState('Mumbai');
  const [state, setState] = useState('Maharashtra');
  const [pincode, setPincode] = useState('401208');
  const [latitude, setLatitude] = useState<number>(currentUser?.latitude || 19.3515);
  const [longitude, setLongitude] = useState<number>(currentUser?.longitude || 72.8525);
  const [openingTime, setOpeningTime] = useState('08:00 AM');
  const [closingTime, setClosingTime] = useState('10:00 PM');
  const [upiId, setUpiId] = useState('stallowner@upi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !phone.trim() || !address.trim()) {
      setError('Please fill in stall name, phone, and address.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await setupOwnerShop({
        ownerName: ownerName.trim(),
        shopName: shopName.trim(),
        description: description.trim(),
        phone: phone.trim(),
        address: address.trim(),
        area: area.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        openingTime,
        closingTime,
        upiId: upiId.trim(),
        stallType,
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      });
      navigate('/business');
    } catch (err: any) {
      console.error('Failed to setup shop:', err);
      setError(err?.message || 'Failed to setup shop. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 max-w-xl mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Register Food Stall Counter
        </h1>
        <p className="text-xs text-slate-500">
          Set up your stall details to start generating digital tokens and accepting live orders
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Stall or Canteen Name *</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="e.g. Deepak Chinese Counter, Sharma Vada Pav"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Stall Type *</label>
            <select
              value={stallType}
              onChange={(e) => setStallType(e.target.value as StallType)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white"
            >
              {STALL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98200 12345"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Address & Landmark *</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Opp. Railway Station Gate 2, Link Road"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Area</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* GPS Live Location & Map Pinpoint Section */}
        <GPSLocationPicker
          latitude={latitude}
          longitude={longitude}
          onChange={({ latitude: newLat, longitude: newLng, area: newArea, city: newCity }) => {
            setLatitude(newLat);
            setLongitude(newLng);
            if (newArea) setArea(newArea);
            if (newCity) setCity(newCity);
          }}
          title="Stall GPS Location & Live Map Pin"
          subtitle="Use your phone/laptop GPS to pinpoint the stall location on the map so customers can accurately track distance and navigate."
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Opening Time</label>
            <input
              type="text"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              placeholder="08:00 AM"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Closing Time</label>
            <input
              type="text"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              placeholder="10:00 PM"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">UPI ID for Online Payments</label>
          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="stallowner@okaxis or stall@upi"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          {loading ? 'Setting up Terminal...' : 'Launch Stall Terminal'}
        </button>
      </form>
    </div>
  );
};
