import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  ShoppingBag, 
  Heart, 
  QrCode, 
  Store, 
  LogOut, 
  Sliders, 
  ShieldCheck, 
  Volume2, 
  ChevronRight,
  ExternalLink,
  Camera,
  CheckCircle2,
  Trash2,
  Sparkles,
  Pencil,
  Save,
  X
} from 'lucide-react';
import { CameraAvatarModal } from '../components/profile/CameraAvatarModal';

interface ProfileViewProps {
  onOpenQRScanner: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenQRScanner }) => {
  const { navigate } = useRouter();
  const { currentUser, role, logout, removeAvatar, updateProfile } = useAuth();
  const { openA11yModal } = useAccessibility();
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: currentUser?.fullName || currentUser?.name || '',
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
  });

  const startEditing = () => {
    setEditForm({
      fullName: currentUser?.fullName || currentUser?.name || '',
      phone: currentUser?.phone || '',
      email: currentUser?.email || '',
    });
    setEditError(null);
    setIsEditing(true);
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editForm.fullName.trim()) {
      setEditError('Full name is required.');
      return;
    }
    if (editForm.phone.replace(/\D/g, '').length < 10) {
      setEditError('Enter a valid 10-digit phone number.');
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      await updateProfile({
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || undefined,
      });
      setIsEditing(false);
      setSuccessToast('Profile details updated successfully.');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      setEditError(err?.message || 'Could not update profile details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove your custom profile photo?')) return;
    setIsRemoving(true);
    try {
      await removeAvatar();
      setSuccessToast('Profile photo removed.');
      setTimeout(() => setSuccessToast(null), 3000);
    } finally {
      setIsRemoving(false);
    }
  };

  const isOwner = role === 'owner';

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 max-w-2xl mx-auto space-y-6 pb-28">
      {/* Toast Alert */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-extrabold text-sm ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-4">
          {/* Avatar with Camera badge */}
          <div className="relative flex-shrink-0">
            {currentUser?.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.fullName || 'User Avatar'}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500 shadow-md shadow-orange-500/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-orange-500/20">
                {currentUser?.fullName?.charAt(0) || currentUser?.name?.charAt(0) || 'U'}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 hover:bg-orange-600 active:scale-95 text-white flex items-center justify-center shadow-md border-2 border-white transition-all"
              title="Take photo with device camera"
              aria-label="Take photo with device camera"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                {currentUser?.fullName || currentUser?.name || 'Customer'}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-800">
                {role || 'Customer'}
              </span>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentUser?.phone || '+91 98765 43210'}</span>
            </p>

            {currentUser?.email && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{currentUser.email}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {isEditing && (
          <form onSubmit={handleProfileSave} className="mt-5 pt-5 border-t border-slate-100 space-y-3">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                {editError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700">
                Full name
                <input
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((form) => ({ ...form, fullName: event.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </label>
              <label className="text-xs font-bold text-slate-700">
                Phone number
                <input
                  value={editForm.phone}
                  onChange={(event) => setEditForm((form) => ({ ...form, phone: event.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-700">
              Email address
              <input
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((form) => ({ ...form, email: event.target.value }))}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white text-xs font-bold"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {/* Camera Quick Action Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Camera className="w-3.5 h-3.5 text-orange-500" />
            <span className="font-semibold">
              {currentUser?.photoUrl ? 'Custom photo active' : 'Set custom camera avatar'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{currentUser?.photoUrl ? 'Retake Photo' : 'Take Photo'}</span>
            </button>

            {currentUser?.photoUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isRemoving}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors"
                title="Remove custom photo"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Business Owner Switcher Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="px-2 py-0.5 rounded bg-orange-500 text-[10px] font-extrabold uppercase tracking-wider text-white">
              Food Stall Partner
            </span>
            <h3 className="text-base font-black mt-1">Run a Food Stall or Canteen?</h3>
            <p className="text-xs text-slate-300 mt-0.5 max-w-sm">
              Manage digital queue tokens, receive live orders, and toggle items instantly.
            </p>
          </div>

          <button
            onClick={() => navigate(isOwner ? '/business' : '/setup-shop')}
            className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-black shadow-xs flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          >
            <Store className="w-4 h-4 text-orange-600" />
            <span>{isOwner ? 'Open Stall Terminal' : 'Register Your Stall'}</span>
          </button>
        </div>
      </div>

      {/* Quick Menu Options */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        <button
          onClick={() => navigate('/orders')}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Your Orders & Tokens</h4>
              <p className="text-[11px] text-slate-500">Live order status, past receipts & tokens</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={() => navigate('/saved')}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Saved Stalls</h4>
              <p className="text-[11px] text-slate-500">Your favorite local tapris and food counters</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={onOpenQRScanner}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Scan Stall Counter QR</h4>
              <p className="text-[11px] text-slate-500">Instantly open stall menu and order</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={openA11yModal}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Accessibility & Audio Chimes</h4>
              <p className="text-[11px] text-slate-500">Voice token caller, high contrast, sound alerts</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>

      {/* Device Camera Avatar Modal */}
      <CameraAvatarModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSuccess={() => {
          setSuccessToast('Custom profile photo saved to Firestore!');
          setTimeout(() => setSuccessToast(null), 4000);
        }}
      />
    </div>
  );
};
