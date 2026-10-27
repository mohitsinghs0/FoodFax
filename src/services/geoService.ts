/**
 * Reusable Geo Location & Distance Calculation Service
 * Uses the Haversine formula to compute great-circle distance between two GPS coordinates in kilometers.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface CityPreset {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  popularArea: string;
  tagline: string;
}

export const INDIAN_CITIES: CityPreset[] = [
  {
    id: 'naigaon',
    name: 'Naigaon / Vasai (MMR)',
    state: 'Maharashtra',
    latitude: 19.3515,
    longitude: 72.8525,
    popularArea: 'Naigaon East / Station Road',
    tagline: 'Wok Noodles, Fast Food & Local Street Counters',
  },
  {
    id: 'mumbai',
    name: 'Mumbai (Andheri)',
    state: 'Maharashtra',
    latitude: 19.1197,
    longitude: 72.8464,
    popularArea: 'Andheri West / Vile Parle',
    tagline: 'Home of Mumbai Vada Pav, Pav Bhaji & Cutting Chai',
  },
  {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    latitude: 18.5204,
    longitude: 73.8567,
    popularArea: 'FC Road / Deccan Gymkhana',
    tagline: 'Authentic Puneri Misal, Vada Pav & Chai (150 km from Mumbai)',
  },
  {
    id: 'delhi',
    name: 'Delhi NCR',
    state: 'Delhi',
    latitude: 28.6506,
    longitude: 77.2303,
    popularArea: 'Chandni Chowk / Connaught Place',
    tagline: 'Crispy Aloo Chaat, Chole Bhature & Roll Stalls (1400 km away)',
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    popularArea: 'Koramangala / Indiranagar',
    tagline: 'Filter Coffee, Podi Dosa & Hot Idli Counters (980 km away)',
  },
  {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    state: 'Gujarat',
    latitude: 23.0225,
    longitude: 72.5714,
    popularArea: 'Manek Chowk / Law Garden',
    tagline: 'Khaman, Maskabun & Night Food Stalls (520 km away)',
  },
  {
    id: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    latitude: 26.9124,
    longitude: 75.7873,
    popularArea: 'MI Road / Bapu Bazaar',
    tagline: 'Pyaaz Kachori, Mirchi Vada & Lassi (1150 km away)',
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    latitude: 17.3850,
    longitude: 78.4867,
    popularArea: 'Charminar / Madhapur',
    tagline: 'Irani Chai, Osmania Biscuits & Dosas (710 km away)',
  },
];

export const DEFAULT_NEARBY_RADIUS_KM = 15.0;

/**
 * Calculates distance in kilometers between two lat/long points using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 999;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 1 decimal place (e.g. 0.4 km)
  return Math.round(distance * 10) / 10;
}

/**
 * Checks whether two points are within the given radius.
 */
export function isWithinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusKm: number = DEFAULT_NEARBY_RADIUS_KM
): boolean {
  const dist = calculateDistanceKm(lat1, lon1, lat2, lon2);
  return dist <= radiusKm;
}

/**
 * Formats distance cleanly for UI presentation.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters}m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Default fallback coordinates: Naigaon East / Vasai (MMR)
 */
export const DEFAULT_CUSTOMER_LOCATION: GeoPoint & { area: string; city: string } = {
  latitude: 19.3515,
  longitude: 72.8525,
  area: 'Naigaon East',
  city: 'Naigaon / Vasai (MMR)',
};

/**
 * High-Accuracy Browser Geolocation helper
 * Uses watchPosition with maximumAge: 0 to acquire genuine hardware GPS satellite locks
 * rather than relying on stale cached IP/cell-tower approximations.
 */
export async function getBrowserLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let settled = false;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Timeout safety fallback: after 7 seconds, return best reading or error
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();

      if (bestPosition) {
        resolve({
          latitude: bestPosition.coords.latitude,
          longitude: bestPosition.coords.longitude,
        });
      } else {
        // Fallback to single fast attempt
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }, 7000);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return;

        // Keep the reading with highest accuracy (lowest accuracy radius in meters)
        if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = pos;
        }

        // Pinpoint accuracy achieved (satellite locked within 25 meters)
        if (pos.coords.accuracy <= 25) {
          settled = true;
          cleanup();
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // Force fresh hardware GPS reading
      }
    );
  });
}

/**
 * Resolves shop GPS coordinates, falling back gracefully through:
 * 1. Explicit shop.latitude & shop.longitude
 * 2. Nested shop.location.latitude & shop.location.longitude
 * 3. Default active city coordinates (Naigaon East / MMR)
 */
export function resolveShopCoordinates(shop?: any): { latitude: number; longitude: number } {
  const lat = Number(shop?.latitude || shop?.location?.latitude);
  const lng = Number(shop?.longitude || shop?.location?.longitude);

  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return { latitude: lat, longitude: lng };
  }

  return {
    latitude: DEFAULT_CUSTOMER_LOCATION.latitude,
    longitude: DEFAULT_CUSTOMER_LOCATION.longitude,
  };
}

/**
 * Builds canonical Google Maps navigation/directions URL
 */
export function buildGoogleMapsDirectionsUrl(
  latitude: number,
  longitude: number,
  destinationName?: string,
  travelMode: 'walking' | 'driving' = 'walking'
): string {
  const destName = destinationName ? encodeURIComponent(destinationName.trim()) : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${destName}&travelmode=${travelMode}`;
}

/**
 * Builds Google Maps search / point-of-interest URL
 */
export function buildGoogleMapsSearchUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/**
 * Calculates estimated travel time from distance in km
 */
export function calculateEstimatedTime(
  distanceKm: number,
  mode: 'walking' | 'driving' = 'walking'
): { minutes: number; label: string } {
  const dist = Math.max(0.05, Number(distanceKm) || 0.1);
  // Average speeds in Indian urban street counters: walking ~4.5 km/h, driving/bike ~20 km/h
  const speed = mode === 'walking' ? 4.5 : 20.0;
  const rawMinutes = (dist / speed) * 60;
  const minutes = Math.max(1, Math.round(rawMinutes));

  const label =
    mode === 'walking'
      ? `${minutes} min${minutes > 1 ? 's' : ''} walk`
      : `${minutes} min${minutes > 1 ? 's' : ''} drive`;

  return { minutes, label };
}

