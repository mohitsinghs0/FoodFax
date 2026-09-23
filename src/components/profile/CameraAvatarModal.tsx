import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  RefreshCw, 
  X, 
  Check, 
  Upload, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CameraAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (photoUri: string) => void;
}

export const CameraAvatarModal: React.FC<CameraAvatarModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, updateAvatar, removeAvatar } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera stream
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopStream();
    setIsLoadingCamera(true);
    setCameraError(null);

    // Verify browser supports mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser. You can upload an image file instead.');
      setIsLoadingCamera(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      };

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        // Fallback with basic video constraint
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('[CameraAvatar] Failed to access camera:', err);
      let errorMsg = 'Could not access device camera. Please check your camera permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission was denied. Please allow camera access in your browser settings or upload a file.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera device found on this system. You can upload a photo file below.';
      }
      setCameraError(errorMsg);
    } finally {
      setIsLoadingCamera(false);
    }
  }, [stopStream]);

  // Mount/Unmount stream management
  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setCameraError(null);
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen]);

  // Handle camera switch toggle
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture snapshot from video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera is still initializing, please try again in a second.');
      return;
    }

    // Trigger visual flash
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    const canvas = canvasRef.current || document.createElement('canvas');
    const targetSize = 360;
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Crop center square
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minDim) / 2;
    const startY = (video.videoHeight - minDim) / 2;

    // Mirror image if user-facing camera for natural selfie look
    if (facingMode === 'user') {
      ctx.translate(targetSize, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      video,
      startX,
      startY,
      minDim,
      minDim,
      0,
      0,
      targetSize,
      targetSize
    );

    // Export as high-quality compressed JPEG (typically ~35-45KB)
    const dataUri = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUri);
    stopStream();
  };

  // Handle fallback file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCameraError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const targetSize = 360;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
        const dataUri = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUri);
        stopStream();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera(facingMode);
  };

  // Save photo to Firestore user profile document
  const handleSaveAvatar = async () => {
    if (!capturedPhoto) return;

    setIsSaving(true);
    try {
      await updateAvatar(capturedPhoto);
      if (onSuccess) {
        onSuccess(capturedPhoto);
      }
      onClose();
    } catch (err: any) {
      console.error('[CameraAvatar] Failed to save avatar:', err);
      setCameraError(err?.message || 'Failed to save avatar to profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Remove existing avatar photo
  const handleRemoveExistingAvatar = async () => {
    if (!confirm('Are you sure you want to remove your custom profile photo?')) return;
    setIsSaving(true);
    try {
      await removeAvatar();
      onClose();
    } catch (err: any) {
      setCameraError('Failed to remove avatar: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 id="camera-modal-title" className="text-sm font-black text-slate-900 leading-tight">
                {capturedPhoto ? 'Review Photo' : 'Take Profile Photo'}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {capturedPhoto ? 'Looks good? Save to profile' : 'Position face inside the frame'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
            aria-label="Close camera modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder or Preview Area */}
        <div className="relative bg-slate-950 aspect-square w-full flex items-center justify-center overflow-hidden">
          {shutterFlash && (
            <div className="absolute inset-0 bg-white z-30 opacity-90 transition-opacity duration-150 pointer-events-none" />
          )}

          {capturedPhoto ? (
            // Preview Captured Photo
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900">
              <div className="relative w-56 h-56 rounded-full overflow-hidden ring-4 ring-orange-500 shadow-2xl">
                <img
                  src={capturedPhoto}
                  alt="Captured Profile Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="mt-3 text-[11px] font-bold text-orange-400 bg-orange-950/80 px-3 py-1 rounded-full border border-orange-800/60">
                Avatar Preview
              </span>
            </div>
          ) : (
            // Live Video Stream Viewfinder
            <>
              {isLoadingCamera && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 text-slate-300 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <span className="text-xs font-semibold">Starting camera...</span>
                </div>
              )}

              {cameraError ? (
                <div className="p-6 text-center text-slate-200 space-y-3 z-20">
                  <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-medium text-slate-300 max-w-xs">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Image File</span>
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />

                  {/* Circular target frame guide */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-60 h-60 rounded-full border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] relative">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2">
                        <span className="w-3 h-0.5 bg-white/80" />
                        <span className="w-3 h-0.5 bg-white/80" />
                      </div>
                      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col justify-between py-2">
                        <span className="w-0.5 h-3 bg-white/80" />
                        <span className="w-0.5 h-3 bg-white/80" />
                      </div>
                    </div>
                  </div>

                  {/* Switch camera button */}
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white border border-white/20 flex items-center justify-center backdrop-blur-xs transition-colors"
                    title="Flip camera"
                    aria-label="Flip camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          {capturedPhoto ? (
            // Actions when photo is captured
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAvatar}
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/20 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Avatar</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            // Shutter capture controls
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors"
                title="Upload image from device"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Upload</span>
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isLoadingCamera || !!cameraError}
                className="w-14 h-14 rounded-full bg-orange-600 hover:bg-orange-500 active:scale-95 text-white flex items-center justify-center p-1.5 ring-4 ring-orange-500/20 shadow-lg shadow-orange-600/30 transition-all disabled:opacity-40 disabled:scale-100"
                aria-label="Take picture"
              >
                <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center">
                  <Camera className="w-5 h-5 fill-white/20" />
                </div>
              </button>

              {currentUser?.photoUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveExistingAvatar}
                  disabled={isSaving}
                  className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 font-medium text-xs flex items-center gap-1.5 transition-colors"
                  title="Remove existing avatar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              ) : (
                <div className="w-14" />
              )}
            </div>
          )}

          <p className="text-[10px] text-center text-slate-400">
            Stored securely in your Supabase user profile
          </p>
        </div>
      </div>
    </div>
  );
};
