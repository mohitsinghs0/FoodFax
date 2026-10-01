import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { shopService } from '../services/shopService';
import { orderService } from '../services/orderService';
import { INDIAN_CITIES, CityPreset, getBrowserLocation, DEFAULT_CUSTOMER_LOCATION } from '../services/geoService';
import { Shop, ShopCategory, Order } from '../types';
import { ShopCard } from '../components/shop/ShopCard';
import { NearbyFoodRadar } from '../components/discovery/NearbyFoodRadar';
import { 
  Search, 
  QrCode, 
  Flame, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  Store, 
  Receipt,
  Heart,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  SlidersHorizontal,
  Navigation,
  Globe,
  Plane,
  X,
  Check
} from 'lucide-react';

interface HomeViewProps {
  onOpenQRScanner: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenQRScanner }) => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  // Detect authenticated mode
  const isAuthenticated = Boolean(
    currentUser && !currentUser.isDemo && currentUser.id !== 'demo-customer-001' && currentUser.id !== 'demo-owner-001'
  );
  const isRealUser = true;

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const [distanceFilter, setDistanceFilter] = useState<'5km' | '10km' | '15km' | '50km' | 'all' | '100km+'>('all');
  const [isRadarExpanded, setIsRadarExpanded] = useState<boolean>(false);
  const [onlyOpen, setOnlyOpen] = useState<boolean>(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [savedShopIds, setSavedShopIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Active location state (checks localStorage, user profile, or Naigaon East default)
  const [activeLocation, setActiveLocation] = useState<{
    latitude: number;
    longitude: number;
    area: string;
    city: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('foodfax_active_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude && !parsed.area?.includes('Andheri')) {
          return parsed;
        }
      }
    } catch {}
    return {
      latitude: currentUser?.latitude || DEFAULT_CUSTOMER_LOCATION.latitude,
      longitude: currentUser?.longitude || DEFAULT_CUSTOMER_LOCATION.longitude,
      area: currentUser?.area && !currentUser.area.includes('Andheri') ? currentUser.area : DEFAULT_CUSTOMER_LOCATION.area,
      city: currentUser?.city && !currentUser.city.includes('Andheri') ? currentUser.city : DEFAULT_CUSTOMER_LOCATION.city,
    };
  });

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  // Persist active location to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('foodfax_active_location', JSON.stringify(activeLocation));
    } catch {}
  }, [activeLocation]);

  // Reload shops whenever active location changes & subscribe to real-time shop deletions/updates
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [cats, allShops, orders] = await Promise.all([
        shopService.getCategories(),
        shopService.getNearbyShops(
          undefined,
          undefined,
          {
            latitude: activeLocation.latitude,
            longitude: activeLocation.longitude,
          },
          isRealUser
        ),
        currentUser?.id ? orderService.getCustomerOrders(currentUser.id) : Promise.resolve([]),
      ]);
      setCategories(cats);
      setShops(allShops);
      setRecentOrders(
        currentUser
          ? orders.filter((o) => !o.isDemo && !o.id.startsWith('ord-100')).slice(0, 3)
          : []
      );
      setSavedShopIds(shopService.getSavedShopIds());
      setLoading(false);
    };

    fetchData();

    // Subscribe to live shop deletions and updates
    const unsubscribeShops = shopService.subscribeToShops((updatedShops) => {
      setShops(updatedShops);
    });

    return () => {
      unsubscribeShops();
    };
  }, [activeLocation.latitude, activeLocation.longitude, currentUser?.id]);

  const handleToggleSaved = (shopId: string) => {
    shopService.toggleSaveShop(shopId);
    setSavedShopIds(shopService.getSavedShopIds());
  };

  const handleSelectCityPreset = (city: CityPreset) => {
    setActiveLocation({
      latitude: city.latitude,
      longitude: city.longitude,
      area: city.popularArea,
      city: city.name,
    });
    setIsCityModalOpen(false);
    // For Naigaon preset, 5km or 15km is perfect
    if (city.id === 'naigaon') {
      setDistanceFilter('15km');
    } else {
      setDistanceFilter('50km');
    }
  };

  const handleSelectNaigaonShortcut = () => {
    setActiveLocation({
      latitude: 19.3515,
      longitude: 72.8525,
      area: 'Naigaon East / Station Road',
      city: 'Naigaon / Vasai (MMR)',
    });
    setDistanceFilter('15km');
  };

  const handleDetectGPS = async () => {
    setGpsLoading(true);
    setGpsMessage(null);
    try {
      const coords = await getBrowserLocation();
      let areaName = 'Current Location';
      let cityName = 'Detected Area';

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=16&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};
          areaName =
            addr.suburb ||
            addr.neighbourhood ||
            addr.road ||
            addr.residential ||
            addr.village ||
            data.name ||
            'Detected Location';
          cityName = addr.city || addr.town || addr.county || addr.state_district || 'Local Area';
        }
      } catch (err) {
        console.warn('Reverse geocode fallback:', err);
      }

      const newLoc = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        area: areaName,
        city: cityName,
      };
      setActiveLocation(newLoc);
      setGpsMessage(`Location set to ${areaName}, ${cityName}`);
      setTimeout(() => {
        setIsCityModalOpen(false);
        setGpsMessage(null);
      }, 700);
    } catch (err: any) {
      setGpsMessage(err?.message || 'Unable to access GPS.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Distance & category filtering
  let filteredShops = selectedCategory === 'all'
    ? shops
    : shops.filter((s) => s.categories && s.categories.includes(selectedCategory));

  if (onlyOpen) {
    filteredShops = filteredShops.filter((s) => s.isOpen);
  }

  if (distanceFilter === '5km') {
    filteredShops = filteredShops.filter((s) => (s.location?.distanceKm ?? 0) <= 5.0);
  } else if (distanceFilter === '10km') {
    filteredShops = filteredShops.filter((s) => (s.location?.distanceKm ?? 0) <= 10.0);
  } else if (distanceFilter === '15km') {
    filteredShops = filteredShops.filter((s) => (s.location?.distanceKm ?? 0) <= 15.0);
  } else if (distanceFilter === '50km') {
    filteredShops = filteredShops.filter((s) => (s.location?.distanceKm ?? 0) <= 50.0);
  } else if (distanceFilter === '100km+') {
    filteredShops = filteredShops.filter((s) => (s.location?.distanceKm ?? 0) >= 100.0);
  }

  const popularShops = shops.filter((s) => s.rating >= 4.7 && (s.location?.distanceKm ?? 0) <= 25.0);
  const savedShops = shops.filter((s) => savedShopIds.includes(s.id));

  // Count stalls by distance buckets for quick indicator
  const shopsUnder10km = shops.filter((s) => (s.location?.distanceKm ?? 0) <= 10.0).length;
  const shopsUnder15km = shops.filter((s) => (s.location?.distanceKm ?? 0) <= 15.0).length;
  const remoteShopsCount = shops.filter((s) => (s.location?.distanceKm ?? 0) >= 100.0).length;

  // Active token notification preview if user has an ongoing counter order
  const activeOrder = recentOrders.find(
    (o) => o.orderStatus === 'PREPARING' || o.orderStatus === 'READY' || o.orderStatus === 'ACCEPTED'
  );

  return (
    <div className="pb-24 max-w-5xl mx-auto px-3 sm:px-6 space-y-5 sm:space-y-7 pt-3 sm:pt-5 overflow-x-hidden">
      {/* ACTIVE LIVE TOKEN CALLOUT (If customer already ordered) */}
      {currentUser && activeOrder && (
        <div
          id="active-order-banner"
          onClick={() => navigate(`/order/${activeOrder.id}`)}
          className="cursor-pointer bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl p-3.5 sm:p-4 text-white shadow-lg shadow-orange-600/20 flex items-center justify-between gap-2.5 sm:gap-3 hover:brightness-105 transition-all"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/20 backdrop-blur-xs flex flex-col items-center justify-center font-black leading-none text-white flex-shrink-0">
              <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-orange-200">Token</span>
              <span className="text-xs sm:text-sm">{activeOrder.tokenNumber}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/25 px-1.5 py-0.5 rounded flex-shrink-0">
                  {activeOrder.orderStatus}
                </span>
                <span className="text-xs text-orange-100 font-semibold truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[200px]">
                  {activeOrder.shopName}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-white/95 mt-0.5 font-medium line-clamp-1">
                {activeOrder.orderStatus === 'READY'
                  ? 'Your food is READY at the counter! Tap to collect.'
                  : 'Preparing now. Tap to track live token progress.'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80 flex-shrink-0" />
        </div>
      )}

      {/* QUICK HERO & SEARCH BAR */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {isAuthenticated
                  ? `Welcome, ${currentUser?.fullName || currentUser?.name || 'Foodie'}!`
                  : 'Order. Skip the Queue. Collect.'}
              </h1>
              {isAuthenticated && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300/60 flex-shrink-0">
                  Verified Account
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-normal">
              {isAuthenticated
                ? `Showing authentic food stalls near ${activeLocation.area || activeLocation.city}.`
                : 'Instant counter pickup at verified local food stalls, canteens & snacks counters.'}
            </p>
          </div>

          {/* Direct Scan QR Button for quick access */}
          <button
            id="hero-scan-qr-btn"
            onClick={onOpenQRScanner}
            className="self-stretch sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold transition-all shadow-sm shadow-orange-600/20 flex-shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Shop / Counter QR</span>
          </button>
        </div>

        {/* Search Input Box */}
        <div
          onClick={() => navigate('/search')}
          className="relative flex items-center bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-orange-300 transition-all p-3 sm:p-3.5 cursor-pointer group min-w-0"
        >
          <Search className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-slate-400 group-hover:text-orange-600 transition-colors mr-2.5 sm:mr-3 flex-shrink-0" />
          <span className="text-slate-400 text-xs sm:text-sm font-medium truncate flex-1 min-w-0">
            Search "Hakka Noodles", "Manchurian", "Vada Pav", "Chai", or stall name...
          </span>
          <span className="ml-2 hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 flex-shrink-0">
            Tap to search
          </span>
        </div>

        {/* Real User Location & Proximity Filter Bar with GPS and Naigaon Shortcut */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs overflow-hidden transition-colors">
          {/* Main Location Info Row */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Left: Icon + City/Area Info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0 border border-orange-200/60">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Location:
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 truncate max-w-[130px]">
                    {activeLocation.city}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-0.5" title={activeLocation.area}>
                  {activeLocation.area}
                </p>
              </div>
            </div>

            {/* Quick GPS Button */}
            <button
              onClick={handleDetectGPS}
              disabled={gpsLoading}
              title="Detect GPS location"
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95 touch-manipulation"
            >
              <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-bold">GPS</span>
            </button>
          </div>

          {/* Action Buttons Row: Change Area & Radar Map */}
          <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2.5 border-t border-slate-100">
            <button
              onClick={() => setIsCityModalOpen(true)}
              className="text-xs font-bold text-slate-700 hover:text-orange-600 bg-slate-50 hover:bg-orange-50/70 py-2 px-3 rounded-xl transition-all border border-slate-200 hover:border-orange-200 flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span>Change Area</span>
            </button>

            <button
              onClick={() => setIsRadarExpanded(!isRadarExpanded)}
              className={`text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 border active:scale-98 ${
                isRadarExpanded
                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                  : 'text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border-orange-200'
              }`}
              title={isRadarExpanded ? 'Hide Radar Map' : 'Explore Nearby Food Discovery & Distance Radar Map'}
              aria-expanded={isRadarExpanded}
            >
              <Compass className={`w-3.5 h-3.5 ${isRadarExpanded ? 'animate-spin' : ''}`} style={isRadarExpanded ? { animationDuration: '6s' } : undefined} />
              <span>{isRadarExpanded ? 'Hide Map' : 'Radar Map'}</span>
              {isRadarExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Expandable Nearby Food Discovery & Distance Radar Map */}
          {isRadarExpanded && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
              <NearbyFoodRadar
                embedded={true}
                initialLocation={activeLocation}
                onLocationChange={(loc) => {
                  setActiveLocation((prev) => ({
                    ...prev,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    city: loc.city || prev.city,
                    area: loc.area || prev.area,
                  }));
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* CATEGORIES PILLS SCROLLER */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Quick Categories
          </h2>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="text-xs font-bold text-orange-600 hover:underline"
            >
              Reset to All
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`cat-chip-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/20'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* POPULAR NEAR YOU / BEST STALLS */}
      {selectedCategory === 'all' && popularShops.length > 0 && distanceFilter !== '100km+' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Popular Near {activeLocation.city}
              </h2>
            </div>
            <button
              onClick={() => navigate('/shops')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
            >
              <span>See All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularShops.slice(0, 3).map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                isSaved={savedShopIds.includes(shop.id)}
                onToggleSaved={handleToggleSaved}
              />
            ))}
          </div>
        </section>
      )}

      {/* NEARBY SHOPS / ALL COUNTERS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
              <Store className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {distanceFilter === '100km+'
                ? 'Outstation & Cross-City Food Stalls (100+ km)'
                : selectedCategory === 'all'
                ? `Food Stalls in ${activeLocation.city} (${distanceFilter})`
                : 'Category Stalls'}
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              ({filteredShops.length})
            </span>
          </div>
        </div>

        {filteredShops.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-10 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
              <Store className="w-7 h-7" />
            </div>

            <div className="space-y-1.5 max-w-lg mx-auto">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                No shops found nearby
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {`No registered food stalls found within ${distanceFilter === 'all' ? 'any range' : distanceFilter} of ${activeLocation.area || activeLocation.city}.`}
              </p>
            </div>

            {/* If registered stalls exist in database (e.g. Deepak Chinese Corner in Naigaon) but filtered out by distance */}
            {shops.length > 0 && (
              <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-4 max-w-md mx-auto text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🍜</span>
                    <h4 className="text-xs font-bold text-slate-900">
                      Registered Stall: {shops[0].name}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                    ~{shops[0].location?.distanceKm?.toFixed(1) || '25.8'} km away
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Located at {shops[0].location?.address || 'Shop No. 4, Station Road, Naigaon East'}.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setDistanceFilter('50km');
                      setSelectedCategory('all');
                      setOnlyOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    View {shops[0].name} (Range 50 km)
                  </button>
                  <button
                    onClick={handleSelectNaigaonShortcut}
                    className="px-3 py-1.5 rounded-lg bg-white border border-orange-300 text-orange-700 hover:bg-orange-50 text-xs font-bold transition-colors"
                  >
                    Set Location to Naigaon East
                  </button>
                </div>
              </div>
            )}

            {/* Standard Helpful Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                onClick={handleDetectGPS}
                disabled={gpsLoading}
                className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>Use My Exact GPS</span>
              </button>
              <button
                onClick={() => setIsCityModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Locality / City</span>
              </button>
              <button
                onClick={onOpenQRScanner}
                className="px-3.5 py-2 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5 text-orange-600" />
                <span>Scan Counter QR</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShops.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                isSaved={savedShopIds.includes(shop.id)}
                onToggleSaved={handleToggleSaved}
              />
            ))}
          </div>
        )}
      </section>

      {/* SAVED SHOPS SECTION */}
      {selectedCategory === 'all' && savedShops.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                My Saved Shops
              </h2>
            </div>
            <button
              onClick={() => navigate('/saved')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700"
            >
              View All ({savedShops.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedShops.slice(0, 2).map((shop) => (
              <ShopCard
                key={`saved-${shop.id}`}
                shop={shop}
                layout="horizontal"
                isSaved={true}
                onToggleSaved={handleToggleSaved}
              />
            ))}
          </div>
        </section>
      )}

      {/* RECENT COUNTER ORDERS SECTION */}
      {currentUser && selectedCategory === 'all' && recentOrders.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Recent Orders
              </h2>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700"
            >
              Order History
            </button>
          </div>

          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/order/${order.id}`)}
                className="bg-white rounded-xl border border-slate-200/90 hover:border-orange-300 p-3 flex items-center justify-between gap-3 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 font-mono font-bold text-xs text-orange-700 flex items-center justify-center border border-orange-200/60">
                    {order.tokenNumber}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">
                      {order.shopName}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'} • ₹{order.total} • {order.orderType === 'DINE_IN' ? 'Dine-in' : 'Takeaway'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      order.orderStatus === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : order.orderStatus === 'COMPLETED'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CITY / LOCATION SELECTOR MODAL */}
      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Select Your City / Location
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Find stalls near you or explore outstation street food
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCityModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3">
              <button
                onClick={handleDetectGPS}
                disabled={gpsLoading}
                className="w-full p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Navigation className={`w-4 h-4 text-emerald-600 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>{gpsLoading ? 'Detecting GPS coordinates...' : 'Use My Current GPS Location'}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-600" />
              </button>
              {gpsMessage && (
                <p className="text-xs text-emerald-700 font-medium mt-1.5 px-1">
                  {gpsMessage}
                </p>
              )}
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Popular Cities & Food Hubs:
            </p>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {INDIAN_CITIES.map((city) => {
                const isCurrent = activeLocation.city.toLowerCase() === city.name.toLowerCase();
                return (
                  <button
                    key={city.id}
                    onClick={() => handleSelectCityPreset(city)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'border-orange-500 bg-orange-50/50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs text-slate-900">
                          {city.name}
                        </h4>
                        <span className="text-[10px] text-slate-500">
                          ({city.state})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {city.popularArea}
                      </p>
                      <p className="text-[10px] text-orange-600 font-medium">
                        {city.tagline}
                      </p>
                    </div>
                    {isCurrent && (
                      <Check className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
