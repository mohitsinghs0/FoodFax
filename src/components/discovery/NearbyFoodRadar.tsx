import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  Compass,
  MapPin,
  Search,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  AlertCircle,
  RefreshCw,
  Map as MapIcon,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../supabase';
import { calculateDistanceKm, DEFAULT_CUSTOMER_LOCATION, INDIAN_CITIES } from '../../services/geoService';
import { shopService } from '../../services/shopService';
import { Shop } from '../../types';

export interface NearbyFoodSpot {
  id: string;
  name: string;
  stall_type?: string;
  stallType?: string;
  is_mobile_stall?: boolean;
  address?: string;
  area?: string;
  city?: string;
  latitude: number;
  longitude: number;
  rating?: number | null;
  total_reviews?: number;
  preparation_time_minutes?: string;
  preparationTimeMinutes?: string;
  is_open?: boolean;
  isOpen?: boolean;
  table_service_available?: boolean;
  tableServiceAvailable?: boolean;
  accepts_delivery?: boolean;
  delivery_radius_km?: number;
  delivery_fee_type?: string;
  delivery_fee_amount?: number;
  distance_meters?: number;
  distance_km?: number;
  distanceKm?: number;
  is_pure_veg?: boolean;
  isPureVeg?: boolean;
  image?: string;
  tagline?: string;
}

export type RadiusKm = 1 | 2 | 3 | 5;
export type ServiceMode = 'all' | 'dine_in' | 'takeaway' | 'delivery';

export interface NearbyFoodRadarProps {
  embedded?: boolean;
  initialLocation?: {
    latitude: number;
    longitude: number;
    city?: string;
    area?: string;
  };
  onLocationChange?: (loc: { latitude: number; longitude: number; city: string; area: string }) => void;
}

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

// Dark mode styles for Google Maps
const darkGoogleMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#38bdf8' }] },
];

export const NearbyFoodRadar: React.FC<NearbyFoodRadarProps> = ({
  embedded = false,
  initialLocation,
  onLocationChange,
}) => {
  // Determine initial coordinates: prefer Naigaon East or saved localStorage over old Andheri
  const getInitialCoords = () => {
    if (initialLocation && initialLocation.latitude && initialLocation.longitude) {
      if (!initialLocation.area?.includes('Andheri')) {
        return {
          coords: { lat: initialLocation.latitude, lng: initialLocation.longitude },
          area: initialLocation.area || DEFAULT_CUSTOMER_LOCATION.area,
          city: initialLocation.city || DEFAULT_CUSTOMER_LOCATION.city,
        };
      }
    }
    try {
      const saved = localStorage.getItem('foodfax_active_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude && !parsed.area?.includes('Andheri')) {
          return {
            coords: { lat: parsed.latitude, lng: parsed.longitude },
            area: parsed.area || DEFAULT_CUSTOMER_LOCATION.area,
            city: parsed.city || DEFAULT_CUSTOMER_LOCATION.city,
          };
        }
      }
    } catch {}
    return {
      coords: { lat: DEFAULT_CUSTOMER_LOCATION.latitude, lng: DEFAULT_CUSTOMER_LOCATION.longitude },
      area: DEFAULT_CUSTOMER_LOCATION.area,
      city: DEFAULT_CUSTOMER_LOCATION.city,
    };
  };

  const initial = getInitialCoords();

  // Customer Coordinates & location status (Default: Naigaon East)
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number }>(initial.coords);
  const [customerArea, setCustomerArea] = useState<string>(initial.area);
  const [customerCity, setCustomerCity] = useState<string>(initial.city);
  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | 'manual' | 'preset'>('preset');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Discovery Filters - Fixed strictly to 2 km
  const [selectedRadius, setSelectedRadius] = useState<RadiusKm>(2);
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceMode>('all');

  // Manual search
  const [searchLocationQuery, setSearchLocationQuery] = useState<string>('');
  const [showLocationInput, setShowLocationInput] = useState<boolean>(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);

  // Nearby food spots
  const [nearbySpots, setNearbySpots] = useState<NearbyFoodSpot[]>([]);
  const [isLoadingSpots, setIsLoadingSpots] = useState<boolean>(true);

  // Map Provider: 'leaflet' (Clean HD OpenStreetMap, zero watermarks) or 'google'
  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet'>('leaflet');
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState<boolean>(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Google Map refs
  const googleMapRef = useRef<any>(null);
  const googleCustomerMarkerRef = useRef<any>(null);
  const googleRadiusCircleRef = useRef<any>(null);
  const googleShopMarkersRef = useRef<any[]>([]);
  const googleActiveInfoWindowRef = useRef<any>(null);

  // Leaflet fallback refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletRadiusCircleRef = useRef<L.Circle | null>(null);
  const leafletCustomerMarkerRef = useRef<L.Marker | null>(null);
  const leafletShopMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  // Detect dark mode
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Sync with initialLocation prop when parent updates (skip if outdated Andheri)
  useEffect(() => {
    if (initialLocation && initialLocation.latitude && initialLocation.longitude) {
      if (!initialLocation.area?.includes('Andheri')) {
        setCustomerCoords({
          lat: initialLocation.latitude,
          lng: initialLocation.longitude,
        });
        if (initialLocation.area) setCustomerArea(initialLocation.area);
        if (initialLocation.city) setCustomerCity(initialLocation.city);
      }
    }
  }, [initialLocation?.latitude, initialLocation?.longitude, initialLocation?.city, initialLocation?.area]);

  // Load Google Maps Script (available if user chooses to switch to Google Maps)
  useEffect(() => {
    let isMounted = true;

    if (window.google?.maps) {
      if (isMounted) {
        setGoogleMapsLoaded(true);
      }
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('VITE_GOOGLE_MAPS_API_KEY not found. Using OpenStreetMap fallback.');
      if (isMounted) {
        setMapEngine('leaflet');
      }
      return;
    }

    // Auth failure listener (e.g. invalid key or unactivated API in Google Cloud)
    window.gm_authFailure = () => {
      console.warn('Google Maps Authentication Failed. Switching to OpenStreetMap fallback.');
      if (isMounted) {
        setMapEngine('leaflet');
      }
    };

    const existingScript = document.getElementById('google-maps-js-sdk');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-js-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (isMounted && window.google?.maps) {
          setGoogleMapsLoaded(true);
        }
      };
      script.onerror = () => {
        console.warn('Failed to load Google Maps SDK. Using OpenStreetMap fallback.');
        if (isMounted) {
          setMapEngine('leaflet');
        }
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => {
        if (isMounted && window.google?.maps) {
          setGoogleMapsLoaded(true);
        }
      });
      existingScript.addEventListener('error', () => {
        if (isMounted) setMapEngine('leaflet');
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Reverse Geocoding helper using OpenStreetMap Nominatim
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};
          const areaName =
            addr.suburb ||
            addr.neighbourhood ||
            addr.road ||
            addr.residential ||
            addr.village ||
            data.name ||
            'Naigaon East';
          const cityName = addr.city || addr.town || addr.county || addr.state_district || 'Vasai (MMR)';
          setCustomerArea(areaName);
          setCustomerCity(cityName);
          onLocationChange?.({ latitude: lat, longitude: lng, city: cityName, area: areaName });
        }
      } catch (e) {
        console.warn('Reverse geocode fallback:', e);
      }
    },
    [onLocationChange]
  );

  // Fallback: Default to Naigaon East
  const handleIpFallback = useCallback(
    async (reasonNote?: string) => {
      setLocationError(reasonNote || 'Defaulting to Naigaon East.');
      setCustomerCoords({
        lat: DEFAULT_CUSTOMER_LOCATION.latitude,
        lng: DEFAULT_CUSTOMER_LOCATION.longitude,
      });
      setCustomerArea(DEFAULT_CUSTOMER_LOCATION.area);
      setCustomerCity(DEFAULT_CUSTOMER_LOCATION.city);
      setLocationSource('preset');
      setIsLocating(false);
      onLocationChange?.({
        latitude: DEFAULT_CUSTOMER_LOCATION.latitude,
        longitude: DEFAULT_CUSTOMER_LOCATION.longitude,
        city: DEFAULT_CUSTOMER_LOCATION.city,
        area: DEFAULT_CUSTOMER_LOCATION.area,
      });
    },
    [onLocationChange]
  );

  // Locate Customer via navigator.geolocation
  const handleLocateCustomer = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      handleIpFallback('Browser does not support GPS Geolocation.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCustomerCoords(newCoords);
        setLocationSource('gps');
        setIsLocating(false);
        await reverseGeocode(newCoords.lat, newCoords.lng);
      },
      (err) => {
        console.warn('GPS location failed or denied, defaulting to Naigaon East:', err.message);
        handleIpFallback('GPS permission denied or unavailable. Set to Naigaon East.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [handleIpFallback, reverseGeocode]);

  // Manual search for Area or Pincode
  const handleManualLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchLocationQuery.trim();
    if (!query) return;

    setIsSearchingLocation(true);
    setLocationError(null);

    // Check city preset first
    const preset = INDIAN_CITIES.find(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.popularArea.toLowerCase().includes(query.toLowerCase())
    );

    if (preset) {
      setCustomerCoords({ lat: preset.latitude, lng: preset.longitude });
      setCustomerArea(preset.popularArea);
      setCustomerCity(preset.name);
      setLocationSource('preset');
      setIsSearchingLocation(false);
      setShowLocationInput(false);
      setSearchLocationQuery('');
      onLocationChange?.({
        latitude: preset.latitude,
        longitude: preset.longitude,
        city: preset.name,
        area: preset.popularArea,
      });
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', India')}&limit=1`
      );
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const first = results[0];
          const newCoords = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
          setCustomerCoords(newCoords);
          const parts = first.display_name.split(',');
          const area = parts[0]?.trim() || query;
          const city = parts[1]?.trim() || 'India';
          setCustomerArea(area);
          setCustomerCity(city);
          setLocationSource('manual');
          setShowLocationInput(false);
          setSearchLocationQuery('');
          setIsSearchingLocation(false);
          onLocationChange?.({ latitude: newCoords.lat, longitude: newCoords.lng, city, area });
          return;
        }
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }

    setLocationError(`Could not pinpoint "${query}". Try dragging the blue pin on the map.`);
    setIsSearchingLocation(false);
  };

  // Fetch Nearby Food Spots via PostGIS Supabase RPC or Haversine Fallback
  const fetchNearbyFoodSpots = useCallback(async () => {
    setIsLoadingSpots(true);

    let fetchedList: NearbyFoodSpot[] = [];
    let rpcSuccessful = false;

    // A. Attempt Supabase PostGIS RPC: find_nearby_shops
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('find_nearby_shops', {
          customer_lat: customerCoords.lat,
          customer_lng: customerCoords.lng,
          radius_km: selectedRadius,
          service_type: selectedServiceType,
        });

        if (!error && Array.isArray(data)) {
          fetchedList = data.map((item: any) => ({
            ...item,
            distance_km: item.distance_km ?? item.distanceKm,
          }));
          rpcSuccessful = true;
        } else if (error) {
          console.warn('[NearbyFoodRadar] Supabase RPC note (using client Haversine):', error.message);
        }
      } catch (rpcErr) {
        console.warn('[NearbyFoodRadar] RPC invocation failed, fallback active:', rpcErr);
      }
    }

    // B. Client-side fallback if RPC failed or offline mode
    if (!rpcSuccessful) {
      try {
        const allShops: Shop[] = shopService.getStoredShops();
        fetchedList = allShops
          .filter((s) => {
            const lat = s.latitude ?? s.location?.latitude;
            const lng = s.longitude ?? s.location?.longitude;
            if (lat === undefined || lng === undefined) return false;

            const dist = calculateDistanceKm(customerCoords.lat, customerCoords.lng, lat, lng);
            if (dist > selectedRadius) return false;

            if (selectedServiceType === 'dine_in') {
              const hasDineIn =
                s.tableServiceAvailable ||
                s.stallType?.toLowerCase().includes('canteen') ||
                s.stallType?.toLowerCase().includes('counter');
              if (!hasDineIn) return false;
            }

            return true;
          })
          .map((s) => {
            const lat = (s.latitude ?? s.location?.latitude) as number;
            const lng = (s.longitude ?? s.location?.longitude) as number;
            const dist = calculateDistanceKm(customerCoords.lat, customerCoords.lng, lat, lng);
            const isMobile =
              s.stallType?.toLowerCase().includes('thela') ||
              s.stallType?.toLowerCase().includes('cart') ||
              s.stallType?.toLowerCase().includes('stall') ||
              false;
            return {
              id: s.id,
              name: s.name,
              stall_type: s.stallType,
              is_mobile_stall: isMobile,
              tagline: s.tagline,
              image: s.image,
              address: s.location?.address || s.address,
              area: s.location?.landmark || s.area,
              city: s.city || 'Local',
              latitude: lat,
              longitude: lng,
              is_open: s.isOpen,
              is_pure_veg: s.isPureVeg,
              rating: s.rating,
              total_reviews: s.totalReviews,
              preparation_time_minutes: s.preparationTimeMinutes || '10-15',
              table_service_available: s.tableServiceAvailable,
              accepts_delivery: true,
              delivery_radius_km: 3.0,
              delivery_fee_type: 'free',
              delivery_fee_amount: 0,
              distance_meters: Math.round(dist * 1000),
              distance_km: dist,
            };
          })
          .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
      } catch (err) {
        console.error('Fallback query error:', err);
      }
    }

    setNearbySpots(fetchedList);
    setIsLoadingSpots(false);
  }, [customerCoords.lat, customerCoords.lng, selectedRadius, selectedServiceType]);

  useEffect(() => {
    fetchNearbyFoodSpots();
  }, [fetchNearbyFoodSpots]);

  // Helper to build InfoWindow / Popup HTML card (Strictly NO "View Shop" button)
  const buildShopPopupCardHtml = (spot: NearbyFoodSpot) => {
    const isOpen = spot.is_open ?? spot.isOpen ?? true;
    const isMobile = spot.is_mobile_stall;
    const spotType = isMobile ? 'Mobile Stall / Thela' : spot.stall_type || spot.stallType || 'Restaurant / Cafe';
    const prepTime = spot.preparation_time_minutes || spot.preparationTimeMinutes || '10-15';
    const rawMeters = spot.distance_meters;
    const rawDist = spot.distance_km ?? spot.distanceKm;
    const formattedDist =
      rawMeters !== undefined && rawMeters < 1000
        ? `${Math.round(rawMeters)}m away`
        : rawDist !== undefined
        ? `${rawDist.toFixed(1)} km away`
        : 'Nearby';

    const hasRating = spot.rating !== undefined && spot.rating !== null && Number(spot.rating) > 0;
    const ratingMarkup = hasRating
      ? `<div style="display: inline-flex; align-items: center; gap: 3px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #D97706; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 700;">
           <span>★</span> <span>${Number(spot.rating).toFixed(1)}</span>
           ${spot.total_reviews ? `<span style="opacity: 0.8; font-size: 10px;">(${spot.total_reviews})</span>` : ''}
         </div>`
      : `<div class="radar-card-badge" style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 600;">
           <span>New Spot</span>
         </div>`;

    const hasDineIn = spot.table_service_available || spot.tableServiceAvailable;
    const hasDelivery = spot.accepts_delivery;
    const deliveryFeeText =
      spot.delivery_fee_type === 'free' || Number(spot.delivery_fee_amount) === 0
        ? 'Free Delivery'
        : `₹${spot.delivery_fee_amount} Fee`;
    const deliveryRadiusText = spot.delivery_radius_km ? ` (${spot.delivery_radius_km}km)` : '';

    const fulfillmentBadges = `
      <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 8px;">
        ${
          hasDineIn
            ? `<span class="radar-card-badge" style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; display: inline-flex; align-items: center; gap: 3px;">
                🍽️ Dine-In
               </span>`
            : ''
        }
        <span class="radar-card-badge" style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; display: inline-flex; align-items: center; gap: 3px;">
          🥡 Takeaway
        </span>
        ${
          hasDelivery
            ? `<span class="radar-card-badge" style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; display: inline-flex; align-items: center; gap: 3px; color: #2563EB;">
                🛵 ${deliveryFeeText}${deliveryRadiusText}
               </span>`
            : ''
        }
      </div>
    `;

    return `
      <div class="foodfax-radar-card">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 9999px; background: ${
              isOpen ? '#10B981' : '#EF4444'
            };"></span>
            <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${
              isOpen ? '#16A34A' : '#DC2626'
            };">
              ${isOpen ? 'Open Now' : 'Closed'}
            </span>
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #EA580C; background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.25); padding: 2px 7px; border-radius: 6px;">
            ${formattedDist}
          </div>
        </div>

        <h4 class="radar-card-title" style="font-size: 14px; font-weight: 900; line-height: 1.25; margin: 0 0 3px 0;">
          ${spot.name}
        </h4>
        <div style="margin-bottom: 8px;">
          ${
            isMobile
              ? `<span style="display: inline-flex; align-items: center; gap: 4px; color: #EA580C; font-size: 11px; font-weight: 700;">
                   <span>🛞</span> <span>Mobile Stall / Thela</span>
                 </span>`
              : `<span class="radar-card-type" style="font-size: 11px; font-weight: 600;">
                   ${spotType}
                 </span>`
          }
        </div>

        <div class="radar-card-meta-row" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 6px;">
          ${ratingMarkup}
          <div class="radar-card-type" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600;">
            <span>⏱️</span>
            <span>~${prepTime} mins</span>
          </div>
        </div>

        ${fulfillmentBadges}
      </div>
    `;
  };

  // =========================================================================
  // 1. GOOGLE MAPS ENGINE INITIALIZATION & MANAGEMENT
  // =========================================================================
  useEffect(() => {
    if (mapEngine !== 'google' || !googleMapsLoaded || !mapContainerRef.current) return;

    try {
      if (!googleMapRef.current) {
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: customerCoords.lat, lng: customerCoords.lng },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: isDarkMode ? darkGoogleMapStyles : [],
          // GMP usage tracking solution attribution
          internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
        });

        googleMapRef.current = map;
      }
    } catch (err) {
      console.warn('Google Maps initialization failed, switching to Leaflet fallback:', err);
      setMapEngine('leaflet');
    }
  }, [mapEngine, googleMapsLoaded, isDarkMode]);

  // Update Google Maps Customer Pin & Radius Circle
  useEffect(() => {
    if (mapEngine !== 'google' || !googleMapRef.current || !window.google?.maps) return;

    const map = googleMapRef.current;
    const centerLatLng = { lat: customerCoords.lat, lng: customerCoords.lng };

    // Customer Marker (Blue Pulsing Icon)
    const customerSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="rgba(37,99,235,0.25)"/>
        <circle cx="18" cy="18" r="10" fill="rgba(37,99,235,0.5)"/>
        <circle cx="18" cy="18" r="6" fill="#2563EB" stroke="#FFFFFF" stroke-width="2"/>
      </svg>
    `;

    if (googleCustomerMarkerRef.current) {
      googleCustomerMarkerRef.current.setPosition(centerLatLng);
    } else {
      const marker = new window.google.maps.Marker({
        position: centerLatLng,
        map,
        title: 'Your Location (Naigaon East)',
        draggable: true,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(customerSvg)}`,
          scaledSize: new window.google.maps.Size(36, 36),
          anchor: new window.google.maps.Point(18, 18),
        },
      });

      marker.addListener('dragend', async (e: any) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setCustomerCoords({ lat, lng });
        setLocationSource('manual');
        await reverseGeocode(lat, lng);
      });

      googleCustomerMarkerRef.current = marker;
    }

    // Radius Circle
    if (googleRadiusCircleRef.current) {
      googleRadiusCircleRef.current.setCenter(centerLatLng);
      googleRadiusCircleRef.current.setRadius(selectedRadius * 1000);
    } else {
      const circle = new window.google.maps.Circle({
        strokeColor: '#F97316',
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: '#F97316',
        fillOpacity: 0.08,
        map,
        center: centerLatLng,
        radius: selectedRadius * 1000,
      });
      googleRadiusCircleRef.current = circle;
    }

    map.panTo(centerLatLng);
  }, [mapEngine, customerCoords, selectedRadius, reverseGeocode]);

  // Update Google Maps Shop Markers
  useEffect(() => {
    if (mapEngine !== 'google' || !googleMapRef.current || !window.google?.maps) return;

    const map = googleMapRef.current;

    // Clear previous shop markers
    googleShopMarkersRef.current.forEach((m) => m.setMap(null));
    googleShopMarkersRef.current = [];

    const shopSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40">
        <defs>
          <linearGradient id="shopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#EA580C"/>
            <stop offset="100%" stop-color="#F97316"/>
          </linearGradient>
        </defs>
        <path d="M17 0 C7.6 0 0 7.6 0 17 C0 25 17 40 17 40 C17 40 34 25 34 17 C34 7.6 26.4 0 17 0 Z" fill="url(#shopGrad)" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="17" cy="16" r="7.5" fill="#FFFFFF"/>
        <path d="M13.5 14 L20.5 14 L20.5 19.5 L13.5 19.5 Z" fill="#EA580C"/>
        <path d="M12.5 14 L17 10 L21.5 14 Z" fill="#EA580C"/>
      </svg>
    `;

    const newMarkers = nearbySpots.map((spot) => {
      const marker = new window.google.maps.Marker({
        position: { lat: spot.latitude, lng: spot.longitude },
        map,
        title: spot.name,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(shopSvg)}`,
          scaledSize: new window.google.maps.Size(34, 40),
          anchor: new window.google.maps.Point(17, 40),
        },
      });

      marker.addListener('click', () => {
        if (googleActiveInfoWindowRef.current) {
          googleActiveInfoWindowRef.current.close();
        }
        const infoWindow = new window.google.maps.InfoWindow({
          content: buildShopPopupCardHtml(spot),
        });
        infoWindow.open({
          anchor: marker,
          map,
          shouldFocus: false,
        });
        googleActiveInfoWindowRef.current = infoWindow;
      });

      return marker;
    });

    googleShopMarkersRef.current = newMarkers;
  }, [mapEngine, nearbySpots]);

  // =========================================================================
  // 2. LEAFLET FALLBACK ENGINE (Clean OpenStreetMap tiles, NO watermarks)
  // =========================================================================
  useEffect(() => {
    if (mapEngine !== 'leaflet' || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      // Free OpenStreetMap Standard Tiles (No API key, No CartoDB watermarks)
      const map = L.map(mapContainerRef.current, {
        center: [customerCoords.lat, customerCoords.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      leafletShopMarkersLayerRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [mapEngine]);

  // Leaflet customer pin & radius circle
  useEffect(() => {
    if (mapEngine !== 'leaflet' || !leafletMapRef.current) return;

    const map = leafletMapRef.current;
    const customerDivIcon = L.divIcon({
      className: 'custom-customer-pulse-pin',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background: rgba(59, 130, 246, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 22px; height: 22px; border-radius: 9999px; background: rgba(37, 99, 235, 0.45);"></div>
          <div style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background: #2563EB; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);"></div>
        </div>
      `,
      iconSize: [0, 0],
    });

    if (leafletCustomerMarkerRef.current) {
      leafletCustomerMarkerRef.current.setLatLng([customerCoords.lat, customerCoords.lng]);
    } else {
      const marker = L.marker([customerCoords.lat, customerCoords.lng], {
        icon: customerDivIcon,
        draggable: true,
        title: 'Your Location (Naigaon East)',
      }).addTo(map);

      marker.on('dragend', async (e: any) => {
        const markerLatLng = e.target.getLatLng();
        setCustomerCoords({ lat: markerLatLng.lat, lng: markerLatLng.lng });
        setLocationSource('manual');
        await reverseGeocode(markerLatLng.lat, markerLatLng.lng);
      });

      leafletCustomerMarkerRef.current = marker;
    }

    if (leafletRadiusCircleRef.current) {
      leafletRadiusCircleRef.current.setLatLng([customerCoords.lat, customerCoords.lng]);
      leafletRadiusCircleRef.current.setRadius(selectedRadius * 1000);
    } else {
      const radiusCircle = L.circle([customerCoords.lat, customerCoords.lng], {
        radius: selectedRadius * 1000,
        color: '#F97316',
        weight: 2,
        opacity: 0.85,
        fillColor: '#F97316',
        fillOpacity: 0.08,
        dashArray: '6, 8',
      }).addTo(map);

      leafletRadiusCircleRef.current = radiusCircle;
    }

    map.setView([customerCoords.lat, customerCoords.lng], map.getZoom() || 14, { animate: true });
    map.invalidateSize();
  }, [mapEngine, customerCoords, selectedRadius, reverseGeocode]);

  // Leaflet shop markers
  useEffect(() => {
    if (mapEngine !== 'leaflet' || !leafletMapRef.current || !leafletShopMarkersLayerRef.current) return;

    const layer = leafletShopMarkersLayerRef.current;
    layer.clearLayers();

    nearbySpots.forEach((spot) => {
      const shopIcon = L.divIcon({
        className: 'custom-shop-radar-pin',
        html: `
          <div style="position: relative; width: 34px; height: 40px; cursor: pointer; transform: translate(-50%, -100%);">
            <div style="width: 34px; height: 34px; border-radius: 12px; background: linear-gradient(135deg, #EA580C, #F97316); border: 2.5px solid #FFFFFF; box-shadow: 0 8px 16px -2px rgba(234, 88, 12, 0.45); display: flex; align-items: center; justify-content: center; color: white;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
            </div>
            <div style="position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 8px; height: 8px; background: #F97316; border-right: 2px solid #FFFFFF; border-bottom: 2px solid #FFFFFF;"></div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([spot.latitude, spot.longitude], {
        icon: shopIcon,
        title: spot.name,
      });

      marker.bindPopup(buildShopPopupCardHtml(spot), {
        className: 'foodfax-radar-popup',
        offset: [0, -32],
        closeButton: true,
      });

      marker.addTo(layer);
    });
  }, [mapEngine, nearbySpots]);

  // Window resize & layout update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapEngine === 'google' && googleMapRef.current && window.google?.maps) {
        window.google.maps.event.trigger(googleMapRef.current, 'resize');
      } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [mapEngine, customerCoords, selectedRadius]);

  // Zoom and Recenter Controls
  const handleRecenter = () => {
    if (mapEngine === 'google' && googleMapRef.current) {
      googleMapRef.current.panTo({ lat: customerCoords.lat, lng: customerCoords.lng });
      googleMapRef.current.setZoom(14);
    } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
      leafletMapRef.current.setView([customerCoords.lat, customerCoords.lng], 14, { animate: true });
    }
  };

  const handleZoomIn = () => {
    if (mapEngine === 'google' && googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 14) + 1);
    } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapEngine === 'google' && googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 14) - 1);
    } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    }
  };

  return (
    <div
      className={
        embedded
          ? 'space-y-3.5 text-slate-800 dark:text-slate-100 transition-all'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-2xl text-slate-800 dark:text-slate-100 space-y-4 transition-all'
      }
    >
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-sm shadow-orange-500/20 flex-shrink-0">
            <Compass className="w-4.5 h-4.5 animate-spin" style={{ animationDuration: '14s' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Nearby Food Discovery & Distance Radar
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                <MapIcon className="w-3 h-3 text-orange-500" />
                <span>{mapEngine === 'google' ? 'Google Maps' : 'OpenStreetMap'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Instant distance scanning for food stalls & authentic counters around Naigaon East & MMR
            </p>
          </div>
        </div>

        {/* Action Buttons: Locate Me & Search Pin */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleLocateCustomer}
            disabled={isLocating}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Auto-detect current GPS location"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating...' : 'Locate Me'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLocationInput(!showLocationInput)}
            className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Search custom area or pincode"
            aria-label="Search custom area"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Manual Location Search Drawer (Collapsible) */}
      {showLocationInput && (
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <form onSubmit={handleManualLocationSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLocationQuery}
                onChange={(e) => setSearchLocationQuery(e.target.value)}
                placeholder="Enter area, locality or pincode (e.g. Naigaon East, Vasai, 401208)..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingLocation || !searchLocationQuery.trim()}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              {isSearchingLocation ? 'Locating...' : 'Set Pin'}
            </button>
          </form>

          {/* Quick Indian City Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] pt-1">
            <span className="text-slate-500 dark:text-slate-400 font-semibold flex-shrink-0">Presets:</span>
            {INDIAN_CITIES.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => {
                  setCustomerCoords({ lat: city.latitude, lng: city.longitude });
                  setCustomerArea(city.popularArea);
                  setCustomerCity(city.name);
                  setLocationSource('preset');
                  setShowLocationInput(false);
                  onLocationChange?.({
                    latitude: city.latitude,
                    longitude: city.longitude,
                    city: city.name,
                    area: city.popularArea,
                  });
                }}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors border ${
                  city.id === 'naigaon'
                    ? 'bg-orange-50 text-orange-700 border-orange-300 font-bold dark:bg-orange-950/40 dark:text-orange-300'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Detected Address & Coordinates Pill */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <span className="font-bold text-slate-800 dark:text-white truncate max-w-[200px] xs:max-w-xs">
            {customerArea}, {customerCity}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
            ({customerCoords.lat.toFixed(4)}° N, {customerCoords.lng.toFixed(4)}° E)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/60">
            Source: {locationSource === 'gps' ? '🛰️ High GPS' : locationSource === 'ip' ? '🌐 IP Net' : '📍 Manual Pin'}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden xs:inline">
            (Drag blue pin on map)
          </span>
        </div>
      </div>

      {locationError && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 px-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{locationError}</span>
        </p>
      )}

      {/* 4. Fixed Discovery Radius (2 km) & Service Mode Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
        {/* Fixed 2 km Radius Indicator Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-xs font-bold text-orange-700 dark:text-orange-300 shadow-2xs">
            <MapPin className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <span>Coverage Radius: <strong className="font-extrabold text-orange-600 dark:text-orange-400">2 km</strong> (Walking & Quick Pickup Zone)</span>
          </div>
        </div>

        {/* Service Mode Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSelectedServiceType('all')}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl transition-all whitespace-nowrap ${
              selectedServiceType === 'all'
                ? 'bg-orange-600 text-white shadow-xs border border-orange-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            All Spots
          </button>
          <button
            type="button"
            onClick={() => setSelectedServiceType('dine_in')}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
              selectedServiceType === 'dine_in'
                ? 'bg-orange-600 text-white shadow-xs border border-orange-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <UtensilsCrossed className="w-3 h-3 text-orange-500" />
            <span>Dine-In</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedServiceType('takeaway')}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
              selectedServiceType === 'takeaway'
                ? 'bg-orange-600 text-white shadow-xs border border-orange-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <ShoppingBag className="w-3 h-3 text-amber-500" />
            <span>Takeaway</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedServiceType('delivery')}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
              selectedServiceType === 'delivery'
                ? 'bg-orange-600 text-white shadow-xs border border-orange-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Bike className="w-3 h-3 text-blue-500" />
            <span>Shop Delivery</span>
          </button>
        </div>
      </div>

      {/* 5. Interactive Map Viewport (Clean HD Street Map with Google Maps Toggle) */}
      <div className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Custom Map Controls Overlay (Top Right) */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 items-end">
          {/* Map Engine Toggle */}
          <button
            type="button"
            onClick={() => {
              // Toggle engine
              setMapEngine((prev) => (prev === 'leaflet' ? 'google' : 'leaflet'));
            }}
            className="px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-md transition-colors flex items-center gap-1"
            title="Switch between Clean High-Definition Street Map (No watermark) and Google Maps"
          >
            <span>{mapEngine === 'leaflet' ? '🗺️ Clean HD Map' : '🌐 Google Maps'}</span>
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-white flex items-center justify-center border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-md transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-white flex items-center justify-center border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-md transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-md transition-colors"
            title="Re-center on customer location"
            aria-label="Re-center on customer"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* Scanning Radius Tag (Top Left) */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div className="px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 text-[11px] font-extrabold text-orange-600 dark:text-orange-400 shadow-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span>Scanning Radius: 2 km</span>
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoadingSpots && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-20">
            <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white shadow-xl flex items-center gap-2 animate-pulse">
              <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
              <span>Scanning food spots within {selectedRadius} km...</span>
            </div>
          </div>
        )}

        {/* Empty State Overlay */}
        {!isLoadingSpots && nearbySpots.length === 0 && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xl text-center z-10 animate-in fade-in duration-200">
            <Store className="w-7 h-7 text-slate-400 dark:text-slate-500 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-800 dark:text-white">
              No active food spots within {selectedRadius} km
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-2.5">
              Try expanding your radius to discover nearby stalls.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRadius(3)}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Expand to 3 km
              </button>
              <button
                type="button"
                onClick={() => setSelectedRadius(5)}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700"
              >
                Expand to 5 km
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Quick Stats Radar Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Discovered Spots
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
            {nearbySpots.length}{' '}
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">in {selectedRadius}km</span>
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Nearest Stall
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
            {nearbySpots.length > 0 && nearbySpots[0].distance_km !== undefined
              ? nearbySpots[0].distance_km < 1
                ? `${Math.round(nearbySpots[0].distance_km * 1000)}m`
                : `${nearbySpots[0].distance_km.toFixed(1)} km`
              : '—'}
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Live Open Now
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {nearbySpots.filter((s) => s.is_open ?? s.isOpen ?? true).length} Stalls
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Pure Veg Spots
          </span>
          <span className="text-base sm:text-lg font-black text-green-600 dark:text-green-400 mt-0.5 block">
            {nearbySpots.filter((s) => s.is_pure_veg ?? s.isPureVeg).length} Stalls
          </span>
        </div>
      </div>
    </div>
  );
};
