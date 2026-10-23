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
  const [showCongrats, setShowCongrats] = useState(false);
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
      setShowCongrats(true);
      setSuccessToast('Profile details updated successfully.');
      window.setTimeout(() => {
        setSuccessToast(null);
        setShowCongrats(false);
      }, 2600);
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
    setIsRemoving(true);
    try {
      await removeAvatar();
      setSuccessToast('Profile photo removed.');
      setTimeout(() => setSuccessToast(null), 3000);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="py-4 sm:py-6 px-3.5 sm:px-6 max-w-2xl mx-auto space-y-5 sm:space-y-6 pb-28 min-w-0 overflow-x-hidden">
      {/* Toast Alert */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="truncate">{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-extrabold text-sm ml-2 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Avatar with Camera badge */}
          <div className="relative flex-shrink-0">
            {currentUser?.photoUrl && currentUser.photoUrl.trim() !== '' ? (
              <img
                src={currentUser.photoUrl.trim()}
                alt={currentUser?.fullName || 'User Avatar'}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-orange-500 shadow-md shadow-orange-500/20"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-md shadow-orange-500/20">
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
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-black text-slate-900 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
                {currentUser?.fullName || currentUser?.name || 'Customer'}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-800 flex-shrink-0">
                {role || 'Customer'}
              </span>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 truncate">
              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{currentUser?.phone || '+91 98765 43210'}</span>
            </p>

            {currentUser?.email && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{currentUser.email}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex-shrink-0"
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

      {/* Quick Menu Options */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        <button
          onClick={() => navigate('/orders')}
          className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-slate-900 truncate">Your Orders & Tokens</h4>
              <p className="text-[11px] text-slate-500 truncate">Live order status, past receipts & tokens</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>

        <button
          onClick={() => navigate('/saved')}
          className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <Heart className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-slate-900 truncate">Saved Stalls</h4>
              <p className="text-[11px] text-slate-500 truncate">Your favorite local tapris and food counters</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>

        <button
          onClick={onOpenQRScanner}
          className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-slate-900 truncate">Scan Stall Counter QR</h4>
              <p className="text-[11px] text-slate-500 truncate">Instantly open stall menu and order</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>

        <button
          onClick={openA11yModal}
          className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-slate-900 truncate">Accessibility & Audio Chimes</h4>
              <p className="text-[11px] text-slate-500 truncate">Voice token caller, high contrast, sound alerts</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
      {showCongrats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl border border-emerald-100">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-900">Congratulations!</h3>
            <p className="mt-2 text-sm text-slate-600">
              Your profile details have been updated successfully.
            </p>
            <button
              type="button"
              onClick={() => setShowCongrats(false)}
              className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <CameraAvatarModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSuccess={() => {
          setSuccessToast('Custom profile photo saved successfully.');
          setTimeout(() => setSuccessToast(null), 4000);
        }}
      />
    </div>
  );
};
