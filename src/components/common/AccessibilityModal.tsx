import React, { useEffect, useRef } from 'react';
import { useAccessibility, TextSize, ThemeMode } from '../../context/AccessibilityContext';
import { 
  Eye, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Type, 
  Sliders, 
  Keyboard, 
  X, 
  Check, 
  Zap, 
  Activity,
  Info,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';

export const AccessibilityModal: React.FC = () => {
  const {
    themeMode,
    setThemeMode,
    darkMode,
    highContrast,
    toggleHighContrast,
    textSize,
    setTextSize,
    reducedMotion,
    toggleReducedMotion,
    voiceAnnouncements,
    toggleVoiceAnnouncements,
    soundCues,
    toggleSoundCues,
    isA11yModalOpen,
    closeA11yModal,
    announce,
    lastAnnouncement,
    systemDetected,
  } = useAccessibility();

  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key and focus management
  useEffect(() => {
    if (!isA11yModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeA11yModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    closeBtnRef.current?.focus();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isA11yModalOpen, closeA11yModal]);

  if (!isA11yModalOpen) return null;

  const testAudio = () => {
    notificationService.playReadyChime();
    announce('Test chime played successfully. Order alerts will sound like this.', 'assertive', true);
  };

  const textSizes: { key: TextSize; label: string; desc: string; sample: string }[] = [
    { key: 'normal', label: 'Default', desc: '100% standard body text', sample: 'Aa' },
    { key: 'large', label: 'Large', desc: '115% larger font size', sample: 'Aa' },
    { key: 'xlarge', label: 'Extra Large', desc: '125% maximum contrast readability', sample: 'Aa' },
  ];

  const themes: { key: ThemeMode; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'system', label: 'System Auto', desc: 'Syncs with OS dark/light mode', icon: Laptop },
    { key: 'light', label: 'Light Theme', desc: 'High-contrast light appearance', icon: Sun },
    { key: 'dark', label: 'Dark Theme', desc: 'Eye-friendly deep dark mode', icon: Moon },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
      aria-describedby="a11y-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeA11yModal();
      }}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-lg bg-white rounded-3xl shadow-2xl border ${
          highContrast ? 'border-4 border-black' : 'border-slate-200'
        } overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 id="a11y-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Accessibility Preferences
              </h2>
              <p id="a11y-modal-desc" className="text-xs text-slate-500 font-medium">
                Automatic system theme detection & accessible controls
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={closeA11yModal}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-orange-600"
            aria-label="Close accessibility settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* System Detection Live Status Card */}
          <div className="p-3.5 rounded-2xl bg-orange-50/60 border border-orange-200/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold text-orange-900 uppercase tracking-wider">
                System-Level Settings Detected
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white/80 rounded-xl p-2 border border-orange-100">
                <span className="text-[10px] text-slate-500 block font-medium">OS Theme</span>
                <span className="text-xs font-bold text-slate-800">
                  {systemDetected.darkMode ? '🌙 Dark' : '☀️ Light'}
                </span>
              </div>
              <div className="bg-white/80 rounded-xl p-2 border border-orange-100">
                <span className="text-[10px] text-slate-500 block font-medium">High Contrast</span>
                <span className="text-xs font-bold text-slate-800">
                  {systemDetected.highContrast ? '⚡ Active' : 'Normal'}
                </span>
              </div>
              <div className="bg-white/80 rounded-xl p-2 border border-orange-100">
                <span className="text-[10px] text-slate-500 block font-medium">Reduced Motion</span>
                <span className="text-xs font-bold text-slate-800">
                  {systemDetected.reducedMotion ? '💨 Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Theme Mode Selection */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-900 block text-xs uppercase tracking-wider">
              Theme Mode (Dark / Light / System Auto)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {themes.map((t) => {
                const isSelected = themeMode === t.key;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      setThemeMode(t.key);
                      announce(`Theme set to ${t.label}`, 'polite');
                    }}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'border-orange-600 bg-orange-50/80 text-orange-700 ring-2 ring-orange-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <IconComponent className="w-5 h-5 text-orange-600" />
                    <span className="text-xs font-bold block">{t.label}</span>
                    <span className="text-[10px] text-slate-400 block leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              {themeMode === 'system'
                ? `Currently responding to your device settings (Applied: ${darkMode ? 'Dark Mode' : 'Light Mode'}).`
                : `Manually locked to ${themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}.`}
            </p>
          </div>

          {/* High Contrast Mode */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-slate-200 text-slate-800 mt-0.5">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">
                  High Contrast Mode (WCAG AAA)
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Maximizes color contrast ratios, thickens element borders, and sharpens text for low vision.
                </span>
                <span className="text-[10px] font-semibold text-orange-600 mt-1 inline-block">
                  Shortcut: Alt + H
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                toggleHighContrast();
                announce(
                  !highContrast ? 'High contrast enabled' : 'High contrast disabled',
                  'polite'
                );
              }}
              role="switch"
              aria-checked={highContrast}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${
                highContrast ? 'bg-orange-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  highContrast ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Text Sizing */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Type className="w-4 h-4 text-orange-600" />
                Text Sizing & Readability
              </span>
              <span className="text-xs font-semibold text-orange-600 capitalize">
                {textSize} (
                {textSize === 'normal' ? '100%' : textSize === 'large' ? '115%' : '125%'})
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {textSizes.map((item) => {
                const isSelected = textSize === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setTextSize(item.key);
                      announce(`Text size set to ${item.label}`, 'polite');
                    }}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'border-orange-600 bg-orange-50 text-orange-700 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <span className="text-base font-extrabold block mb-0.5">{item.sample}</span>
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-slate-200 text-slate-800 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">
                  Reduce Motion & Animations
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Disables slide, bounce, and continuous pulse effects for vestibular comfort.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                toggleReducedMotion();
                announce(
                  !reducedMotion ? 'Reduced motion enabled' : 'Reduced motion disabled',
                  'polite'
                );
              }}
              role="switch"
              aria-checked={reducedMotion}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${
                reducedMotion ? 'bg-orange-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  reducedMotion ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Voice Announcements via Web Speech Synthesis */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-slate-200 text-slate-800 mt-0.5">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">
                  Voice Announcements (Text-to-Speech)
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Speaks token readiness, counter alerts, and order status aloud using synthetic voice.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                toggleVoiceAnnouncements();
                announce(
                  !voiceAnnouncements
                    ? 'Voice announcements enabled. Order updates will be spoken aloud.'
                    : 'Voice announcements disabled',
                  'assertive',
                  true
                );
              }}
              role="switch"
              aria-checked={voiceAnnouncements}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${
                voiceAnnouncements ? 'bg-orange-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  voiceAnnouncements ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sound Cues & Chime Test */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-slate-200 text-slate-800 mt-0.5">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">
                  Auditory Chimes & Counter Bell
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Plays melodic high-frequency bells when tokens are ready for pickup.
                </span>
                <button
                  onClick={testAudio}
                  className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100/60 hover:bg-orange-100"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Test Ready Bell Chime
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                toggleSoundCues();
                announce(!soundCues ? 'Sound cues enabled' : 'Sound cues disabled', 'polite');
              }}
              role="switch"
              aria-checked={soundCues}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${
                soundCues ? 'bg-orange-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  soundCues ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Keyboard Shortcuts Summary */}
          <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200/70 text-xs space-y-1.5">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-slate-600" />
              Accessible Keyboard Shortcuts
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-600">
              <div>
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[11px] font-bold">
                  Alt + A
                </kbd>{' '}
                Open Preferences
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[11px] font-bold">
                  Alt + H
                </kbd>{' '}
                Toggle Contrast
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-[11px] font-bold">
                  Alt + D
                </kbd>{' '}
                Toggle Dark Mode
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Settings persist automatically across sessions
          </span>
          <button
            onClick={closeA11yModal}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
