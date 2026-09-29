import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type TextSize = 'normal' | 'large' | 'xlarge';
export type ThemeMode = 'system' | 'light' | 'dark';

interface AccessibilityContextType {
  // Theme & Color Modes
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  toggleHighContrast: () => void;

  // Typography Scaling
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;

  // Motion Preferences
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
  toggleReducedMotion: () => void;

  // Voice & Audio Alerts
  voiceAnnouncements: boolean;
  setVoiceAnnouncements: (val: boolean) => void;
  toggleVoiceAnnouncements: () => void;
  soundCues: boolean;
  setSoundCues: (val: boolean) => void;
  toggleSoundCues: () => void;

  // Modal Control
  isA11yModalOpen: boolean;
  setIsA11yModalOpen: (open: boolean) => void;
  openA11yModal: () => void;
  closeA11yModal: () => void;

  // Live Screen Reader & Speech Synthesis announcements
  announce: (message: string, priority?: 'polite' | 'assertive', speakVoice?: boolean) => void;
  lastAnnouncement: string;

  // System detected flags
  systemDetected: {
    darkMode: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
  };
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const PREFS_KEY = 'foodflow_a11y_prefs_v2';

const getSystemDetected = () => {
  if (typeof window === 'undefined') {
    return { darkMode: false, highContrast: false, reducedMotion: false };
  }
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const contrastMoreQuery = window.matchMedia('(prefers-contrast: more)');
  const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  return {
    darkMode: darkQuery.matches,
    highContrast: contrastMoreQuery.matches || forcedColorsQuery.matches,
    reducedMotion: motionQuery.matches,
  };
};

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // System-level live detection state
  const [systemDetected, setSystemDetected] = useState(getSystemDetected);

  // User theme mode selection: 'system', 'light', 'dark'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.themeMode) return parsed.themeMode;
      }
    } catch {
      // fallback
    }
    return 'system';
  });

  // High contrast mode (automatically defaults to true if system high-contrast is active)
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.highContrast === 'boolean') return parsed.highContrast;
      }
    } catch {
      // fallback
    }
    return getSystemDetected().highContrast;
  });

  const [textSize, setTextSize] = useState<TextSize>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) return JSON.parse(saved).textSize || 'normal';
    } catch {
      // fallback
    }
    return 'normal';
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.reducedMotion === 'boolean') return parsed.reducedMotion;
      }
    } catch {
      // fallback
    }
    return getSystemDetected().reducedMotion;
  });

  const [voiceAnnouncements, setVoiceAnnouncements] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) return JSON.parse(saved).voiceAnnouncements || false;
    } catch {
      // fallback
    }
    return false;
  });

  const [soundCues, setSoundCues] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) return JSON.parse(saved).soundCues ?? true;
    } catch {
      // fallback
    }
    return true;
  });

  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);
  const [politeAnnouncement, setPoliteAnnouncement] = useState('');
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState('');
  const [lastAnnouncement, setLastAnnouncement] = useState('');

  // 1. Subscribe to system-level OS / browser changes in real-time
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const contrastMoreQuery = window.matchMedia('(prefers-contrast: more)');
    const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateSystemPreferences = () => {
      const nextSys = {
        darkMode: darkQuery.matches,
        highContrast: contrastMoreQuery.matches || forcedColorsQuery.matches,
        reducedMotion: motionQuery.matches,
      };
      setSystemDetected(nextSys);

      // If user is set to 'system' theme, auto-apply system settings
      try {
        const saved = localStorage.getItem(PREFS_KEY);
        const parsed = saved ? JSON.parse(saved) : {};
        if (!parsed.hasExplicitContrastOverride && nextSys.highContrast) {
          setHighContrast(true);
        }
        if (!parsed.hasExplicitMotionOverride && nextSys.reducedMotion) {
          setReducedMotion(true);
        }
      } catch {
        // ignore
      }
    };

    darkQuery.addEventListener('change', updateSystemPreferences);
    contrastMoreQuery.addEventListener('change', updateSystemPreferences);
    forcedColorsQuery.addEventListener('change', updateSystemPreferences);
    motionQuery.addEventListener('change', updateSystemPreferences);

    return () => {
      darkQuery.removeEventListener('change', updateSystemPreferences);
      contrastMoreQuery.removeEventListener('change', updateSystemPreferences);
      forcedColorsQuery.removeEventListener('change', updateSystemPreferences);
      motionQuery.removeEventListener('change', updateSystemPreferences);
    };
  }, []);

  // Compute active dark mode based on themeMode + systemDetected
  const isDarkMode =
    themeMode === 'dark' || (themeMode === 'system' && systemDetected.darkMode);

  // 2. Persist preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          themeMode,
          highContrast,
          textSize,
          reducedMotion,
          voiceAnnouncements,
          soundCues,
          hasExplicitContrastOverride: true,
          hasExplicitMotionOverride: true,
        })
      );
    } catch {
      // fallback
    }
  }, [themeMode, highContrast, textSize, reducedMotion, voiceAnnouncements, soundCues]);

  // 3. Apply root HTML theme & accessibility classes
  useEffect(() => {
    const root = document.documentElement;

    // Dark Mode class
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    // High Contrast class
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Font scaling
    root.classList.remove('text-scale-large', 'text-scale-xlarge');
    if (textSize === 'large') {
      root.classList.add('text-scale-large');
    } else if (textSize === 'xlarge') {
      root.classList.add('text-scale-xlarge');
    }

    // Reduced motion
    if (reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [isDarkMode, highContrast, textSize, reducedMotion]);

  // 4. Global Keyboard Shortcuts:
  // Alt+A: Open Accessibility Center
  // Alt+H: Toggle High Contrast
  // Alt+D: Toggle Dark Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setIsA11yModalOpen((prev) => !prev);
      } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setHighContrast((prev) => !prev);
      } else if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite', speakVoice: boolean = false) => {
      setLastAnnouncement(message);
      if (priority === 'assertive') {
        setAssertiveAnnouncement(message);
      } else {
        setPoliteAnnouncement(message);
      }

      // If voice announcements are enabled or explicitly requested, use SpeechSynthesis
      if ((voiceAnnouncements || speakVoice) && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch {
          // speech synthesis error fallback
        }
      }
    },
    [voiceAnnouncements]
  );

  const toggleDarkMode = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleHighContrast = useCallback(() => setHighContrast((prev) => !prev), []);
  const toggleReducedMotion = useCallback(() => setReducedMotion((prev) => !prev), []);
  const toggleVoiceAnnouncements = useCallback(() => setVoiceAnnouncements((prev) => !prev), []);
  const toggleSoundCues = useCallback(() => setSoundCues((prev) => !prev), []);
  const openA11yModal = useCallback(() => setIsA11yModalOpen(true), []);
  const closeA11yModal = useCallback(() => setIsA11yModalOpen(false), []);

  return (
    <AccessibilityContext.Provider
      value={{
        themeMode,
        setThemeMode,
        darkMode: isDarkMode,
        toggleDarkMode,
        highContrast,
        setHighContrast,
        toggleHighContrast,
        textSize,
        setTextSize,
        reducedMotion,
        setReducedMotion,
        toggleReducedMotion,
        voiceAnnouncements,
        setVoiceAnnouncements,
        toggleVoiceAnnouncements,
        soundCues,
        setSoundCues,
        toggleSoundCues,
        isA11yModalOpen,
        setIsA11yModalOpen,
        openA11yModal,
        closeA11yModal,
        announce,
        lastAnnouncement,
        systemDetected,
      }}
    >
      {/* Hidden screen reader live regions */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="a11y-live-polite"
      >
        {politeAnnouncement}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        id="a11y-live-assertive"
      >
        {assertiveAnnouncement}
      </div>

      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
