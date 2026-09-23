import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, Layers, Compass, ZoomIn, ZoomOut, Store, AlertCircle } from 'lucide-react';

interface GoogleShopMapProps {
  shopName: string;
  shopLocation?: string;
  landmark?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  height?: string;
}

export const GoogleShopMap: React.FC<GoogleShopMapProps> = ({
  shopName,
  shopLocation,
  landmark,
  address,
  latitude = 19.1197,
  longitude = 72.8464,
  height = 'h-56',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite'>('roadmap');
  const apiKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY;

  // External Google Maps directions URL
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(
    shopName
  )}`;

  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <div className="space-y-3">
      {/* Map Container */}
      <div
        className={`relative ${height} rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-900`}
      >
        {apiKey ? (
          // Official Google Maps Embed API when API key is provided
          <iframe
            title={`Google Map location for ${shopName}`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${latitude},${longitude}&zoom=${zoomLevel}&maptype=${mapStyle}`}
          />
        ) : (
          // Visual High-Resolution Location Canvas with coordinates & controls
          <div className="absolute inset-0 flex flex-col justify-between p-4 overflow-hidden select-none">
            {/* Background Map Grid Simulation */}
            <div
              className={`absolute inset-0 transition-all duration-300 ${
                mapStyle === 'satellite'
                  ? 'bg-slate-950 opacity-95'
                  : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
              }`}
            >
              {/* Coordinate grid lines */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)`,
                  backgroundSize: `${zoomLevel * 2}px ${zoomLevel * 2}px`,
                }}
              />
              {/* Radial radar ring */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-orange-500/20 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-orange-500/30 pointer-events-none animate-ping opacity-25" />
            </div>

            {/* Top Toolbar */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-bold text-white shadow-sm">
                <Compass className="w-3.5 h-3.5 text-orange-400 animate-spin" style={{ animationDuration: '8s' }} />
                <span>GPS: {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMapStyle((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'))}
                  className="px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-[10px] font-bold text-slate-200 transition-colors flex items-center gap-1"
                  title="Toggle Map Style"
                >
                  <Layers className="w-3 h-3 text-orange-400" />
                  <span className="capitalize">{mapStyle}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(20, z + 1))}
                  className="p-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-slate-200"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(12, z - 1))}
                  className="p-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-slate-200"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Center Animated Stall Location Pin */}
            <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-600/40 ring-4 ring-orange-500/20 animate-bounce">
                  <Store className="w-5 h-5" />
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400 mx-auto -mt-1 shadow-sm" />
              </div>
              <div className="mt-2 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-700 text-center shadow-lg">
                <p className="text-xs font-black text-white">{shopName}</p>
                <p className="text-[10px] text-slate-300 font-medium">
                  {address || shopLocation || 'Counter Pickup Point'}
                </p>
              </div>
            </div>

            {/* Bottom Landmark Bar */}
            <div className="relative z-10 flex items-center justify-between text-[11px] pt-1">
              <div className="bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/80 text-orange-300 font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-orange-400" />
                <span>{landmark ? `Landmark: ${landmark}` : 'Campus Counter 1'}</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                Live Coordinates
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Map Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={googleMapsDirectionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Get Directions</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>

        <a
          href={googleMapsSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200 shadow-2xs"
        >
          <MapPin className="w-3.5 h-3.5 text-orange-600" />
          <span>Open in Google Maps</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>
    </div>
  );
};
