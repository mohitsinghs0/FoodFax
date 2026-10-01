/**
 * ShopDirectionMap — Real-time Google Maps component showing:
 *  - Customer's live GPS location (blue pulsing AdvancedMarkerElement)
 *  - Shop pin (orange FoodFax AdvancedMarkerElement)
 *  - Walking / Driving route polyline via Routes API v2 REST (CORS-safe with API key header)
 *  - Distance & ETA badge
 *  - "Open in Google Maps" deeplink for external navigation
 *
 * Uses Maps JavaScript API dynamic importLibrary() — NOT @vis.gl/react-google-maps.
 * Routes API v2 REST: routes.googleapis.com/directions/v2:computeRoutes
 * AdvancedMarkerElement: replaces deprecated google.maps.Marker (CF5/CF7).
 * mapId: "DEMO_MAP_ID" — required for AdvancedMarkerElement (CF9).
 * Attribution: X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1
 *
 * API Keys:
 *   VITE_GOOGLE_MAPS_API_KEY  → Maps JavaScript API (map rendering, markers)
 *   VITE_GOOGLE_ROUTES_API_KEY → Routes API v2 REST (route, polyline, ETA)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Navigation,
  Footprints,
  Car,
  ExternalLink,
  Locate,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useCustomerLiveLocation } from '../../hooks/useCustomerLiveLocation';
import { useAccessibility } from '../../context/AccessibilityContext';

// ─── Minimal type aliases for Google Maps (window.google already declared globally) ─

/* eslint-disable @typescript-eslint/no-explicit-any */
type GMap = any;
type GAdvancedMarker = any;
type GCircle = any;
type GPolyline = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShopDirectionMapProps {
  shopName: string;
  shopLatitude: number;
  shopLongitude: number;
  shopAddress?: string;
  height?: string;
}

type TravelMode = 'WALK' | 'DRIVE';

interface RouteInfo {
  distanceText: string;
  durationText: string;
  distanceMeters: number;
}

// ─── Dark map styles ──────────────────────────────────────────────────────────

const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#484f7b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
];

// ─── Google Maps script loader ────────────────────────────────────────────────

const GM_SCRIPT_ID = 'google-maps-js-sdk';

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      resolve();
      return;
    }
    const existing = document.getElementById(GM_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.id = GM_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&language=en&region=IN`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
}

// ─── Haversine fallback ───────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Decode Google encoded polyline ──────────────────────────────────────────

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ShopDirectionMap: React.FC<ShopDirectionMapProps> = ({
  shopName,
  shopLatitude,
  shopLongitude,
  shopAddress: _shopAddress,
  height = 'h-72',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap>(null);
  const customerMarkerRef = useRef<GAdvancedMarker>(null);
  const shopMarkerRef = useRef<GAdvancedMarker>(null);
  const routePolylineRef = useRef<GPolyline>(null);
  const accuracyCircleRef = useRef<GCircle>(null);

  const [travelMode, setTravelMode] = useState<TravelMode>('WALK');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const { darkMode } = useAccessibility();
  const {
    location: liveLocation,
    error: gpsError,
    isWatching,
  } = useCustomerLiveLocation(true);

  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  // Key for Maps JavaScript API (map rendering, markers, circles)
  const mapsApiKey = env?.VITE_GOOGLE_MAPS_API_KEY ?? '';
  // Key for Routes API v2 REST (route calculation, polyline, ETA)
  // Falls back to mapsApiKey if separate routes key not set
  const routesApiKey = env?.VITE_GOOGLE_ROUTES_API_KEY ?? mapsApiKey;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shopLatitude},${shopLongitude}&destination_place_id=${encodeURIComponent(shopName)}&travelmode=${travelMode === 'WALK' ? 'walking' : 'driving'}`;

  // ── Initialize map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || !mapsApiKey) return;
    let destroyed = false;

    (async () => {
      try {
        await loadGoogleMapsScript(mapsApiKey);
        if (destroyed || !mapContainerRef.current) return;

        const { Map } = await window.google.maps.importLibrary('maps');
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');
        if (destroyed || !mapContainerRef.current) return;

        const map = new Map(mapContainerRef.current, {
          center: { lat: shopLatitude, lng: shopLongitude },
          zoom: 15,
          mapId: 'DEMO_MAP_ID', // CF9 — required for AdvancedMarkerElement
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'cooperative',
          styles: darkMode ? DARK_MAP_STYLES : [],
        });
        mapRef.current = map;

        // Shop marker (orange pin)
        const shopPin = document.createElement('div');
        shopPin.innerHTML = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:default">
            <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#f97316,#ea580c);border:2.5px solid white;box-shadow:0 4px 12px rgba(249,115,22,0.5);display:flex;align-items:center;justify-content:center;transform:rotate(-45deg)">
              <span style="transform:rotate(45deg);font-size:16px">🏪</span>
            </div>
            <div style="margin-top:4px;background:rgba(249,115,22,0.95);color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${shopName}</div>
          </div>`;
        shopMarkerRef.current = new AdvancedMarkerElement({
          map,
          position: { lat: shopLatitude, lng: shopLongitude },
          content: shopPin,
          title: shopName,
        });

        setMapReady(true);
      } catch (err) {
        console.error('[ShopDirectionMap] init failed:', err);
        if (!destroyed) setMapError('Map failed to load. Check API key or network.');
      }
    })();

    return () => {
      destroyed = true;
      if (customerMarkerRef.current) { customerMarkerRef.current.map = null; customerMarkerRef.current = null; }
      if (shopMarkerRef.current) { shopMarkerRef.current.map = null; shopMarkerRef.current = null; }
      if (routePolylineRef.current) { routePolylineRef.current.setMap(null); routePolylineRef.current = null; }
      if (accuracyCircleRef.current) { accuracyCircleRef.current.setMap(null); accuracyCircleRef.current = null; }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsApiKey, shopLatitude, shopLongitude, shopName]);

  // ── Sync dark/light map style ─────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setOptions({ styles: darkMode ? DARK_MAP_STYLES : [] });
    }
  }, [darkMode]);

  // ── Update customer live marker ───────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !liveLocation) return;

    (async () => {
      const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');
      const customerPos = { lat: liveLocation.lat, lng: liveLocation.lng };

      if (!customerMarkerRef.current) {
        const blob = document.createElement('div');
        blob.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px">
            <div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.3);z-index:2;position:relative"></div>
            <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(37,99,235,0.15);animation:pulse-blue 2s infinite"></div>
          </div>`;
        customerMarkerRef.current = new AdvancedMarkerElement({
          map: mapRef.current,
          position: customerPos,
          content: blob,
          title: 'Your Location',
          zIndex: 10,
        });
      } else {
        customerMarkerRef.current.position = customerPos;
      }

      // Accuracy circle
      if (liveLocation.accuracy && liveLocation.accuracy < 500) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setCenter(customerPos);
          accuracyCircleRef.current.setRadius(liveLocation.accuracy);
        } else {
          const { Circle } = await window.google.maps.importLibrary('maps');
          accuracyCircleRef.current = new Circle({
            map: mapRef.current,
            center: customerPos,
            radius: liveLocation.accuracy,
            strokeColor: '#2563eb',
            strokeOpacity: 0.4,
            strokeWeight: 1,
            fillColor: '#2563eb',
            fillOpacity: 0.08,
          });
        }
      }

      // Auto-fit both markers
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(customerPos);
      bounds.extend({ lat: shopLatitude, lng: shopLongitude });
      mapRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
    })();
  }, [mapReady, liveLocation, shopLatitude, shopLongitude]);

  // ── Compute route via Routes API v2 REST ─────────────────────────────────
  const computeRoute = useCallback(async () => {
    if (!mapRef.current || !liveLocation || !routesApiKey) return;
    setRouteLoading(true);

    try {
      const body = {
        origin: {
          location: {
            latLng: { latitude: liveLocation.lat, longitude: liveLocation.lng },
          },
        },
        destination: {
          location: {
            latLng: { latitude: shopLatitude, longitude: shopLongitude },
          },
        },
        travelMode: travelMode === 'WALK' ? 'WALK' : 'DRIVE',
        ...(travelMode === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
        computeAlternativeRoutes: false,
        languageCode: 'en-IN',
        internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
      };

      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': routesApiKey,
          'X-Goog-FieldMask':
            'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
          'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Routes API ${res.status}`);
      const data = await res.json();
      const route = data?.routes?.[0];
      if (!route) throw new Error('No route returned');

      const meters: number = route.distanceMeters ?? 0;
      const durationSec = parseInt((route.duration ?? '0s').replace('s', ''), 10);
      const distKm =
        meters >= 1000
          ? `${(meters / 1000).toFixed(1)} km`
          : `${Math.round(meters)} m`;
      const mins = Math.round(durationSec / 60);
      const durationText = mins < 1 ? '< 1 min' : `${mins} min`;

      setRouteInfo({ distanceText: distKm, durationText, distanceMeters: meters });

      // Draw encoded polyline
      const encodedPoly: string = route.polyline?.encodedPolyline ?? '';
      if (encodedPoly && mapRef.current) {
        const path = decodePolyline(encodedPoly);
        if (routePolylineRef.current) {
          routePolylineRef.current.setPath(path);
          routePolylineRef.current.setOptions({
            strokeColor: travelMode === 'WALK' ? '#2563eb' : '#f97316',
          });
        } else {
          routePolylineRef.current = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: travelMode === 'WALK' ? '#2563eb' : '#f97316',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map: mapRef.current,
          });
        }
      }
    } catch (err) {
      // Fallback: haversine straight-line estimate
      console.warn('[ShopDirectionMap] Route fallback (haversine):', err);
      const km = haversineKm(
        liveLocation.lat,
        liveLocation.lng,
        shopLatitude,
        shopLongitude,
      );
      const mins =
        travelMode === 'WALK'
          ? Math.round((km / 4.5) * 60)
          : Math.round((km / 20) * 60);
      setRouteInfo({
        distanceText:
          km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`,
        durationText: `~${mins} min (est.)`,
        distanceMeters: Math.round(km * 1000),
      });
    } finally {
      setRouteLoading(false);
    }
  }, [liveLocation, shopLatitude, shopLongitude, travelMode, routesApiKey]);

  // Trigger route compute on location/mode change
  useEffect(() => {
    if (mapReady && liveLocation) computeRoute();
  }, [mapReady, liveLocation, travelMode, computeRoute]);

  // ── Re-center on customer ─────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!mapRef.current || !liveLocation) return;
    mapRef.current.panTo({ lat: liveLocation.lat, lng: liveLocation.lng });
    mapRef.current.setZoom(16);
  }, [liveLocation]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!mapsApiKey) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 text-center gap-3">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
          Google Maps API key not configured.
        </p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-6 text-center gap-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{mapError}</p>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-bold underline"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Travel mode toggle + distance badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTravelMode('WALK')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            travelMode === 'WALK'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          <Footprints className="w-3.5 h-3.5" />
          Walk
        </button>
        <button
          onClick={() => setTravelMode('DRIVE')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            travelMode === 'DRIVE'
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-200 dark:shadow-orange-900'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          Drive
        </button>

        {routeLoading ? (
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating…
          </span>
        ) : routeInfo ? (
          <span className="ml-auto text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
            {routeInfo.distanceText} · {routeInfo.durationText}
          </span>
        ) : null}
      </div>

      {/* GPS error notice */}
      {gpsError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{gpsError} Showing shop location only.</span>
        </div>
      )}

      {/* Map — CF2: parent div must have explicit height */}
      <div
        className={`relative ${height} rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm`}
      >
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Floating controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {liveLocation && (
            <button
              onClick={handleRecenter}
              title="Re-center on my location"
              className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors"
            >
              <Locate className="w-4 h-4 text-blue-600" />
            </button>
          )}
          <button
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 14) + 1)}
            className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-700 dark:text-slate-300 font-bold text-sm leading-none"
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 14) - 1)}
            className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-700 dark:text-slate-300 font-bold text-sm leading-none"
          >
            −
          </button>
        </div>

        {/* Loading overlay */}
        {!mapReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 gap-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading map…</p>
          </div>
        )}

        {/* Map legend */}
        {mapReady && (
          <div className="absolute bottom-3 left-3 flex flex-col gap-1 z-10">
            <div className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-300 dark:ring-blue-800 shrink-0" />
              You
            </div>
            <div className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-orange-200 dark:ring-orange-900 shrink-0" />
              <span className="truncate max-w-[100px]">{shopName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Open in Google Maps */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-bold transition-all shadow-sm active:scale-[0.98]"
      >
        <Navigation className="w-4 h-4" />
        Get Directions in Google Maps
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </a>

      {/* GPS live status */}
      {isWatching && liveLocation && (
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Live GPS active
          {liveLocation.accuracy
            ? ` · accuracy ±${Math.round(liveLocation.accuracy)}m`
            : ''}
        </p>
      )}
    </div>
  );
};

