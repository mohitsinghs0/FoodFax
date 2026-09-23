import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { getBrowserLocation, DEFAULT_CUSTOMER_LOCATION } from '../services/geoService';
import { User, MapPin, Navigation, ArrowRight, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { CameraAvatarModal } from '../components/profile/CameraAvatarModal';

export const CompleteProfileView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser, completeCustomerProfile } = useAuth();

  const [fullName, setFullName] = useState(currentUser?.fullName || currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [area, setArea] = useState(currentUser?.area || 'Bandra West');
  const [city, setCity] = useState(currentUser?.city || 'Mumbai');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(currentUser?.photoUrl);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: currentUser?.latitude || DEFAULT_CUSTOMER_LOCATION.latitude,
    longitude: currentUser?.longitude || DEFAULT_CUSTOMER_LOCATION.longitude,
  });
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUseGps = async () => {
    setLocating(true);
    try {
      const pos = await getBrowserLocation();
      setCoords({ latitude: pos.latitude, longitude: pos.longitude });
    } catch (err) {
      console.warn('GPS failed, keeping default coords');
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await completeCustomerProfile({
        fullName: fullName.trim() || 'Food Lover',
        phone: phone.trim() || '+91 98765 43210',
        latitude: coords.latitude,
        longitude: coords.longitude,
        area: area.trim(),
        city: city.trim(),
        photoUrl: photoUrl,
      });
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="relative w-16 h-16 mx-auto">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Avatar Preview"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500 shadow-md shadow-orange-500/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
              <User className="w-8 h-8" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 hover:bg-orange-600 text-white flex items-center justify-center shadow-md border-2 border-white transition-colors"
            title="Take photo with camera"
          >
            <Camera className="w-3 h-3" />
          </button>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Complete Your Profile
        </h1>
        <p className="text-xs text-slate-500">
          Set your local area and optional photo avatar so you can enjoy fast counter tokens
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Area / Locality</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Bandra, Dadar"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleUseGps}
            disabled={locating}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className={`w-3.5 h-3.5 text-orange-500 ${locating ? 'animate-spin' : ''}`} />
            <span>{locating ? 'Locating...' : 'Use Current Device Location'}</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          {loading ? 'Saving Profile...' : 'Save and Start Exploring'}
        </button>
      </form>

      <CameraAvatarModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSuccess={(uri) => {
          setPhotoUrl(uri);
        }}
      />
    </div>
  );
};
