/**
 * useCustomerLiveLocation — Real-time GPS hook using navigator.geolocation.watchPosition.
 * Continuously tracks the customer's device position with high accuracy.
 * Provides clean fallback when GPS is unavailable or permission is denied.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface CustomerLiveLocation {
  lat: number;
  lng: number;
  accuracy: number | null; // meters
  heading: number | null; // degrees (0-360) or null when stationary
  timestamp: number; // epoch ms
}

interface UseCustomerLiveLocationReturn {
  location: CustomerLiveLocation | null;
  error: string | null;
  isWatching: boolean;
  startWatching: () => void;
  stopWatching: () => void;
}

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 3000,
};

/**
 * Returns true if position has moved enough to warrant an update.
 * Prevents excessive re-renders when GPS sends sub-metre jitter updates.
 */
function hasSignificantMove(
  prev: CustomerLiveLocation | null,
  next: GeolocationCoordinates
): boolean {
  if (!prev) return true;
  const latDiff = Math.abs(prev.lat - next.latitude);
  const lngDiff = Math.abs(prev.lng - next.longitude);
  // ~3.5 m at equator ≈ 0.00003 degrees; suppress smaller jitter
  return latDiff > 0.00003 || lngDiff > 0.00003;
}

export function useCustomerLiveLocation(
  autoStart = false
): UseCustomerLiveLocationReturn {
  const [location, setLocation] = useState<CustomerLiveLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setError(null);
    setLocation((prev) => {
      if (!hasSignificantMove(prev, pos.coords)) return prev;
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        timestamp: pos.timestamp,
      };
    });
  }, []);

  const onError = useCallback((err: GeolocationPositionError) => {
    const messages: Record<number, string> = {
      1: 'Location permission denied. Please allow location access in browser settings.',
      2: 'Unable to determine your position. Check GPS signal.',
      3: 'Location request timed out. Move to a better signal area.',
    };
    setError(messages[err.code] || 'Location unavailable.');
    setIsWatching(false);
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    if (watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      HIGH_ACCURACY_OPTIONS
    );
    setIsWatching(true);
    setError(null);
  }, [onSuccess, onError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  useEffect(() => {
    if (autoStart) {
      startWatching();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [autoStart, startWatching]);

  return { location, error, isWatching, startWatching, stopWatching };
}

