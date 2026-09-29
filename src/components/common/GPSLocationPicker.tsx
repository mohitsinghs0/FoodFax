import React, { useState } from 'react';
import { 
  MapPin, 
  Navigation, 
  Crosshair, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Compass
} from 'lucide-react';
import { getBrowserLocation, INDIAN_CITIES } from '../../services/geoService';

interface GPSLocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (coords: { latitude: number; longitude: number; area?: string; city?: string }) => void;
  title?: string;
  subtitle?: string;
}

export const GPSLocationPicker: React.FC<GPSLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  title = "Live GPS Location & Map Pinpoint",
  subtitle = "Ensure customers see your accurate real-time distance and find your counter easily on the map."
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handleDetectGPS = async () => {
    setIsDetecting(true);
    setGpsError(null);
    setGpsMessage(null);

    try {
      const pos = await getBrowserLocation();
      const roundedLat = Math.round(pos.latitude * 100000) / 100000;
      const roundedLng = Math.round(pos.longitude * 100000) / 100000;

      onChange({
        latitude: roundedLat,
        longitude: roundedLng,
      });

      setGpsMessage(`Live GPS locked: ${roundedLat.toFixed(4)}°N, ${roundedLng.toFixed(4)}°E`);
      setActivePreset(null);
    } catch (err: any) {
      console.warn('GPS detection warning:', err);
      const msg = err?.message || 'Could not fetch device location. Please allow location permissions or enter coordinates manually.';
      setGpsError(msg);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSelectPreset = (city: typeof INDIAN_CITIES[0]) => {
    onChange({
      latitude: city.latitude,
      longitude: city.longitude,
      area: city.popularArea.split('/')[0].trim(),
      city: city.name.split('(')[0].trim(),
    });
    setActivePreset(city.id);
    setGpsMessage(`Preset selected: ${city.name} (${city.popularArea})`);
    setGpsError(null);
  };

  const handleManualLatChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({ latitude: num, longitude });
      setActivePreset(null);
    }
  };

  const handleManualLngChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({ latitude, longitude: num });
      setActivePreset(null);
    }
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  
  // Calculate bounding box for embedded OpenStreetMap view
  const delta = 0.006;
  const bbox = `${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <div className="rounded-2xl border border-orange-200/90 bg-gradient-to-b from-orange-50/40 to-white p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <Navigation className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900">{title}</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Live GPS Action Button */}
        <button
          type="button"
          onClick={handleDetectGPS}
          disabled={isDetecting}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 disabled:bg-slate-300 text-white text-xs font-bold shadow-xs shadow-orange-500/20 transition-all cursor-pointer shrink-0"
        >
          {isDetecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching GPS...</span>
            </>
          ) : (
            <>
              <Crosshair className="w-4 h-4" />
              <span>Detect Live GPS</span>
            </>
          )}
        </button>
      </div>

      {/* Success / Info Feedback */}
      {gpsMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{gpsMessage}</span>
        </div>
      )}

      {/* Error Feedback */}
      {gpsError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Coordinate Display & Manual Adjustment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Latitude (°N)
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => handleManualLatChange(e.target.value)}
              placeholder="e.g. 19.3515"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-mono font-semibold">°N</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Longitude (°E)
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => handleManualLngChange(e.target.value)}
              placeholder="e.g. 72.8525"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-mono font-semibold">°E</span>
          </div>
        </div>
      </div>

      {/* Embedded Live Map Preview */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative shadow-2xs">
        <div className="h-44 sm:h-52 w-full relative">
          <iframe
            title="Stall Live Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={osmEmbedUrl}
            className="w-full h-full border-0 pointer-events-auto"
          />
          {/* Subtle overlay pin badge */}
          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200/80 text-[11px] font-bold text-slate-800 shadow-xs flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />
            <span>Stall Pinpoint</span>
          </div>
        </div>

        <div className="p-3 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600 text-[11px] font-medium truncate">
            <Compass className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span className="truncate">Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-bold hover:underline shrink-0 text-[11px]"
          >
            <span>Open in Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Quick City / Locality Presets */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Or Select Nearby Area Preset:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INDIAN_CITIES.slice(0, 6).map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => handleSelectPreset(city)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                activePreset === city.id
                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {city.name.split('(')[0].trim()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
