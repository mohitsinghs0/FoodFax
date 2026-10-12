import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { shopService, isShopSuspendedOrKycPending } from '../services/shopService';
import { orderService } from '../services/orderService';
import { MOCK_CATEGORIES } from '../data/mockData';
import { 
  INDIAN_CITIES, 
  CityPreset, 
  getBrowserLocation, 
  DEFAULT_CUSTOMER_LOCATION,
  calculateDistanceKm 
} from '../services/geoService';
import { Shop, ShopCategory, Order } from '../types';
import { ShopCard } from '../components/shop/ShopCard';
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
  ChevronLeft,
  Compass, 
  MapPin, 
  SlidersHorizontal, 
  Navigation, 
  X, 
  Check,
  Star,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Zap,
  Filter,
  CheckCircle2,
  Sliders
} from 'lucide-react';

interface HomeViewProps {
  onOpenQRScanner: () => void;
}

// Curated high-res imagery for food categories (matching street food platforms)
const CATEGORY_IMAGE_MAP: Record<string, string> = {
  'all': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
  'vada-pav': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=300&q=80',
  'snacks': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=300&q=80',
  'tea-coffee': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80',
  'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=300&q=80',
  'fast-food': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
  'juice': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80',
  'breakfast': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=300&q=80',
  'pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80',
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
  'momos': 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=300&q=80',
  'chinese': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
  'thali': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80',
  'rolls': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=300&q=80',
};

const INITIAL_CATEGORIES: ShopCategory[] = [
  ...MOCK_CATEGORIES,
  { id: 'pizza', name: 'Pizza', iconName: 'Flame', description: 'Cheese street pizzas' },
  { id: 'burger', name: 'Burgers', iconName: 'Store', description: 'Burgers & buns' },
  { id: 'momos', name: 'Momos', iconName: 'Sparkles', description: 'Steamed & fried momos' },
  { id: 'chinese', name: 'Chinese Wok', iconName: 'Utensils', description: 'Hakka noodles & Manchurian' },
  { id: 'thali', name: 'Thali & Meals', iconName: 'Store', description: 'Desi full meal combos' },
];

// Promotional Hero Slides
interface HeroSlide {
  id: string;
  tagline: string;
  title: string;
  highlightText: string;
  description: string;
  actionText: string;
  badge: string;
  bgGradient: string;
  accentBorder: string;
  actionHandler: 'explore' | 'scan' | 'fast';
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-queue',
    tagline: 'PRE-ORDER & TOKEN SYSTEM',
    title: 'Order Ahead.',
    highlightText: 'Skip The Queue.',
    description: 'Beat the counter rush. Order from verified food stalls & pick up freshly prepared food right when your token is ready.',
    actionText: 'Discover Stalls Near You',
    badge: '⚡ Live Queue Tokens',
    bgGradient: 'from-orange-600 via-amber-600 to-orange-700',
    accentBorder: 'border-orange-400/30',
    actionHandler: 'explore',
  },
  {
    id: 'slide-qr',
    tagline: 'CONTACTLESS AT THE COUNTER',
    title: 'Scan. Order.',
    highlightText: 'Collect Piping Hot.',
    description: 'At the canteen or food court? Simply scan the shop QR code to view the live digital menu without crowding the counter.',
    actionText: 'Scan Stall QR Code',
    badge: '📱 QR Counter Ordering',
    bgGradient: 'from-amber-600 via-orange-600 to-rose-600',
    accentBorder: 'border-amber-400/30',
    actionHandler: 'scan',
  },
  {
    id: 'slide-local',
    tagline: 'AUTHENTIC NEIGHBORHOOD FLAVORS',
    title: 'Your Local Street Food,',
    highlightText: 'Ready When You Are.',
    description: 'From iconic Mumbai Vada Pav and wok noodles to cutting chai, find counters within quick walking distance.',
    actionText: 'View Ready Fast Counters',
    badge: '🚶 Walking Distance (≤ 2 km)',
    bgGradient: 'from-slate-900 via-orange-950 to-slate-900',
    accentBorder: 'border-orange-500/40',
    actionHandler: 'fast',
  },
];

export const HomeView: React.FC<HomeViewProps> = ({ onOpenQRScanner }) => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  const isAuthenticated = Boolean(
    currentUser && !currentUser.isDemo && currentUser.id !== 'demo-customer-001' && currentUser.id !== 'demo-owner-001'
  );
  const isRealUser = Boolean(currentUser && !currentUser.isDemo);

  // Discovery & Filtering States
  const [categories, setCategories] = useState<ShopCategory[]>(INITIAL_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<'2km' | '4km' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Quick Filter Chips
  const [onlyOpen, setOnlyOpen] = useState<boolean>(false);
  const [onlyVeg, setOnlyVeg] = useState<boolean>(false);
  const [onlyDineIn, setOnlyDineIn] = useState<boolean>(false);
  const [onlyReadyFast, setOnlyReadyFast] = useState<boolean>(false);
  const [onlyTopRated, setOnlyTopRated] = useState<boolean>(false);

  // Shop & Order Data (Synchronously initialized from storage/cache for 0ms initial paint)
  const [shops, setShops] = useState<Shop[]>(() => {
    try {
      return shopService.getStoredShops(isRealUser);
    } catch {
      return [];
    }
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [savedShopIds, setSavedShopIds] = useState<string[]>(() => {
    try {
      return shopService.getSavedShopIds();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  // Promotional Banner Carousel State
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const heroAutoplayRef = useRef<NodeJS.Timeout | null>(null);

  // Active Location State (LocalStorage backed)
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

  // Category horizontal scroll ref
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const popularScrollRef = useRef<HTMLDivElement>(null);

  // Listen for header location modal trigger
  useEffect(() => {
    const handleOpenModal = () => setIsCityModalOpen(true);
    window.addEventListener('foodfax:open-location-modal', handleOpenModal);
    return () => window.removeEventListener('foodfax:open-location-modal', handleOpenModal);
  }, []);

  // Persist active location to localStorage & notify Header
  useEffect(() => {
    try {
      localStorage.setItem('foodfax_active_location', JSON.stringify(activeLocation));
      window.dispatchEvent(new CustomEvent('foodfax:location-changed', { detail: activeLocation }));
    } catch {}
  }, [activeLocation]);

  // Promotional Hero Banner Auto-Play
  useEffect(() => {
    heroAutoplayRef.current = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);

    return () => {
      if (heroAutoplayRef.current) clearInterval(heroAutoplayRef.current);
    };
  }, []);

  // Fetch shops, categories & subscribe to realtime updates
  useEffect(() => {
    let isMounted = true;
    const fetchData = () => {
      // 1. Fetch shops asynchronously - updates UI as soon as available
      shopService.getNearbyShops(
        undefined,
        undefined,
        {
          latitude: activeLocation.latitude,
          longitude: activeLocation.longitude,
        },
        isRealUser
      ).then((allShops) => {
        if (isMounted) {
          setShops(allShops || []);
        }
      }).catch((err) => {
        console.warn('Error fetching nearby shops:', err);
      }).finally(() => {
        if (isMounted) setLoading(false);
      });

      // 2. Fetch categories asynchronously
      shopService.getCategories().then((cats) => {
        if (!isMounted) return;
        const existingIds = new Set(cats.map(c => c.id));
        const enhancedCats = [...cats];
        const staples = [
          { id: 'pizza', name: 'Pizza', iconName: 'Flame', description: 'Cheese street pizzas' },
          { id: 'burger', name: 'Burgers', iconName: 'Store', description: 'Burgers & buns' },
          { id: 'momos', name: 'Momos', iconName: 'Sparkles', description: 'Steamed & fried momos' },
          { id: 'chinese', name: 'Chinese Wok', iconName: 'Utensils', description: 'Hakka noodles & Manchurian' },
          { id: 'thali', name: 'Thali & Meals', iconName: 'Store', description: 'Desi full meal combos' },
        ];
        staples.forEach(s => {
          if (!existingIds.has(s.id)) enhancedCats.push(s as ShopCategory);
        });
        setCategories(enhancedCats);
      }).catch(() => {});

      // 3. Fetch recent customer orders in background without delaying shops
      if (currentUser?.id) {
        orderService.getCustomerOrders(currentUser.id).then((orders) => {
          if (isMounted) {
            setRecentOrders(
              orders.filter((o) => !o.isDemo && !o.id.startsWith('ord-100')).slice(0, 3)
            );
          }
        }).catch(() => {});
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [activeLocation.latitude, activeLocation.longitude, currentUser?.id, isRealUser]);

  // Subscribe to live shop updates once on mount
  useEffect(() => {
    let isMounted = true;
    const unsubscribeShops = shopService.subscribeToShops((updatedShops) => {
      if (isMounted && Array.isArray(updatedShops)) {
        setShops(updatedShops);
        const liveIds = new Set(updatedShops.map((s) => String(s.id || '').trim().toLowerCase()));
        setRecentOrders((prev) =>
          prev.filter((o) => liveIds.has(String(o.shopId || '').trim().toLowerCase()))
        );
      }
    });

    return () => {
      isMounted = false;
      unsubscribeShops();
    };
  }, []);

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
    setDistanceFilter('all');
  };

  const handleDetectGPS = async () => {
    setGpsLoading(true);
    setGpsMessage(null);
    try {
      const coords = await getBrowserLocation();
      let areaName = 'Detected Location';
      let cityName = 'Local Area';

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

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const handleSlideAction = (action: HeroSlide['actionHandler']) => {
    if (action === 'scan') {
      onOpenQRScanner();
    } else if (action === 'fast') {
      setOnlyReadyFast(true);
      const spotsElem = document.getElementById('nearby-food-spots-section');
      spotsElem?.scrollIntoView({ behavior: 'smooth' });
    } else {
      const spotsElem = document.getElementById('nearby-food-spots-section');
      spotsElem?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Helper to parse prep time minimum
  const getPrepMin = (prepStr?: string): number => {
    if (!prepStr) return 10;
    const match = prepStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 10;
  };

  // Compute live shop distance and apply filters (strictly excluding suspended or KYC-pending shops)
  const processedShops = useMemo(() => {
    return shops
      .filter(shop => !isShopSuspendedOrKycPending(shop))
      .map(shop => {
        let dist = shop.location?.distanceKm;
        const sLat = shop.latitude || shop.location?.latitude;
        const sLng = shop.longitude || shop.location?.longitude;
        if (activeLocation.latitude && activeLocation.longitude && sLat && sLng) {
          dist = calculateDistanceKm(activeLocation.latitude, activeLocation.longitude, sLat, sLng);
        }
        return {
          ...shop,
          calculatedDistance: dist ?? 999,
        };
      })
      .sort((a, b) => (a.calculatedDistance ?? 999) - (b.calculatedDistance ?? 999));
  }, [shops, activeLocation.latitude, activeLocation.longitude]);

  // Apply distance, category, and quick filter chips
  const filteredShops = useMemo(() => {
    const list = processedShops.filter(shop => {
      // Distance filter
      if (distanceFilter === '2km' && shop.calculatedDistance > 2.0) return false;
      if (distanceFilter === '4km' && shop.calculatedDistance > 4.0) return false;

      // Category filter
      if (selectedCategory !== 'all') {
        const hasCat = shop.categories && shop.categories.some(c => 
          c.toLowerCase() === selectedCategory.toLowerCase() ||
          c.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          selectedCategory.toLowerCase().includes(c.toLowerCase())
        );
        const nameMatch = shop.name.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          shop.tagline.toLowerCase().includes(selectedCategory.toLowerCase());
        if (!hasCat && !nameMatch) return false;
      }

      // Quick filter chips
      if (onlyOpen && !shop.isOpen) return false;
      if (onlyVeg && !shop.isPureVeg) return false;
      if (onlyDineIn && !shop.tableServiceAvailable) return false;
      if (onlyReadyFast && getPrepMin(shop.preparationTimeMinutes) > 10) return false;
      if (onlyTopRated && shop.rating < 4.5) return false;

      return true;
    });

    // If explicit 2km/4km filter returned 0, but shops exist in the region, gracefully fall back to all matching shops
    // so user is never left staring at an empty list
    if (list.length === 0 && (distanceFilter === '2km' || distanceFilter === '4km') && processedShops.length > 0) {
      return processedShops.filter(shop => {
        if (selectedCategory !== 'all') {
          const hasCat = shop.categories && shop.categories.some(c => 
            c.toLowerCase() === selectedCategory.toLowerCase() ||
            c.toLowerCase().includes(selectedCategory.toLowerCase()) ||
            selectedCategory.toLowerCase().includes(c.toLowerCase())
          );
          const nameMatch = shop.name.toLowerCase().includes(selectedCategory.toLowerCase()) ||
            shop.tagline.toLowerCase().includes(selectedCategory.toLowerCase());
          if (!hasCat && !nameMatch) return false;
        }
        if (onlyOpen && !shop.isOpen) return false;
        if (onlyVeg && !shop.isPureVeg) return false;
        return true;
      });
    }

    return list;
  }, [
    processedShops, 
    distanceFilter, 
    selectedCategory, 
    onlyOpen, 
    onlyVeg, 
    onlyDineIn, 
    onlyReadyFast, 
    onlyTopRated
  ]);

  // Distance counts for switchers
  const shopsUnder2km = useMemo(() => 
    processedShops.filter(s => s.calculatedDistance <= 2.0).length,
    [processedShops]
  );
  const shopsUnder4km = useMemo(() => 
    processedShops.filter(s => s.calculatedDistance <= 4.0).length,
    [processedShops]
  );

  // "Popular Near You" Rail: High rating + prioritized by proximity
  const popularNearYou = useMemo(() => {
    return processedShops
      .filter(s => (s.rating || 0) >= 4.0 && s.calculatedDistance <= (distanceFilter === '4km' ? 4.0 : 5.0))
      .sort((a, b) => a.calculatedDistance - b.calculatedDistance)
      .slice(0, 6);
  }, [processedShops, distanceFilter]);

  // Contextual Data-Driven Section 1: Best Vada Pav Near You
  const vadaPavNearYou = useMemo(() => {
    return processedShops.filter(s => 
      s.calculatedDistance <= 4.0 &&
      (s.categories?.includes('vada-pav') || 
       s.name.toLowerCase().includes('vada') || 
       s.tagline.toLowerCase().includes('vada'))
    ).slice(0, 4);
  }, [processedShops]);

  // Contextual Data-Driven Section 2: Quick Bites Near You (≤ 10 mins prep)
  const quickBitesNearYou = useMemo(() => {
    return processedShops.filter(s => 
      s.isOpen && 
      s.calculatedDistance <= 3.0 &&
      getPrepMin(s.preparationTimeMinutes) <= 10
    ).slice(0, 4);
  }, [processedShops]);

  // Active Live Token Banner check
  const activeOrder = recentOrders.find(
    (o) => o.orderStatus === 'PREPARING' || o.orderStatus === 'READY' || o.orderStatus === 'ACCEPTED'
  );

  const activeFiltersCount = [
    onlyOpen, 
    onlyVeg, 
    onlyDineIn, 
    onlyReadyFast, 
    onlyTopRated
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setOnlyOpen(false);
    setOnlyVeg(false);
    setOnlyDineIn(false);
    setOnlyReadyFast(false);
    setOnlyTopRated(false);
    setDistanceFilter('2km');
  };

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 pt-2.5 sm:pt-4 overflow-x-hidden">
      
      {/* 1. ACTIVE LIVE ORDER TOKEN NOTIFICATION */}
      {currentUser && activeOrder && (
        <section 
          id="active-order-banner"
          aria-label="Active order token callout"
          onClick={() => navigate(`/order/${activeOrder.id}`)}
          className="cursor-pointer bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 rounded-2xl p-3.5 sm:p-4 text-white shadow-md shadow-orange-600/20 flex items-center justify-between gap-3 hover:brightness-105 transition-all"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-xs flex flex-col items-center justify-center font-black leading-none text-white shrink-0 border border-white/20">
              <span className="text-[8px] uppercase tracking-wider text-orange-200">Token</span>
              <span className="text-sm sm:text-base mt-0.5">{activeOrder.tokenNumber}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-md shrink-0">
                  {activeOrder.orderStatus}
                </span>
                <span className="text-xs sm:text-sm text-white font-bold truncate">
                  {activeOrder.shopName}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-orange-100 mt-0.5 font-medium truncate">
                {activeOrder.orderStatus === 'READY'
                  ? 'Your counter order is READY! Tap to view collection code.'
                  : 'Preparing now at the counter. Tap to track queue.'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
        </section>
      )}

      {/* 2. PROMINENT SEARCH BAR & VEG QUICK SWITCH */}
      <section aria-label="Search and dietary preference" className="space-y-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <form 
            onSubmit={handleSearchSubmit} 
            className="flex-1 relative flex items-center bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-orange-400 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all p-2 sm:p-2.5"
          >
            <Search className="w-4.5 h-4.5 text-slate-400 shrink-0 ml-1.5 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for food, shops or dishes..."
              className="w-full text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 mr-1"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shrink-0 transition-colors hidden xs:flex items-center gap-1"
            >
              <span>Search</span>
            </button>
          </form>

          {/* Pure Veg Toggle Switch (Matching food discovery platforms) */}
          <button
            type="button"
            onClick={() => setOnlyVeg(!onlyVeg)}
            aria-pressed={onlyVeg}
            className={`flex items-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-2xl border transition-all text-xs font-bold shrink-0 ${
              onlyVeg 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs' 
                : 'bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle Pure Veg Stalls"
          >
            <span className="w-2.5 h-2.5 rounded-sm border-2 border-emerald-600 flex items-center justify-center p-0.5 shrink-0">
              <span className={`w-1 h-1 rounded-full bg-emerald-600 ${onlyVeg ? 'scale-125' : ''}`} />
            </span>
            <span className="hidden sm:inline">VEG</span>
            <span className={`w-7 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${onlyVeg ? 'bg-emerald-600' : 'bg-slate-300'}`}>
              <span className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform transform ${onlyVeg ? 'translate-x-3' : 'translate-x-0'}`} />
            </span>
          </button>
        </div>

        {/* Location Subtext & Radar Map Shortcut Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-slate-400">Ordering near:</span>
            <button
              type="button"
              onClick={() => setIsCityModalOpen(true)}
              className="font-bold text-slate-800 hover:text-orange-600 flex items-center gap-1 truncate transition-colors underline decoration-slate-300 underline-offset-2"
            >
              <span className="truncate max-w-[220px] sm:max-w-none">{activeLocation.area || activeLocation.city}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick GPS auto-detect */}
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={gpsLoading}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1"
            >
              <Navigation className={`w-3 h-3 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>{gpsLoading ? 'Detecting...' : 'Auto GPS'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. HERO / PROMOTIONAL CAROUSEL BANNER */}
      <section aria-label="FoodFax feature highlights" className="relative">
        <div className="relative overflow-hidden rounded-3xl shadow-sm border border-slate-200/80">
          <div 
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
          >
            {HERO_SLIDES.map((slide) => (
              <div
                key={slide.id}
                className={`w-full shrink-0 p-5 sm:p-7 md:p-9 bg-gradient-to-r ${slide.bgGradient} text-white relative flex flex-col justify-between min-h-[160px] sm:min-h-[190px]`}
              >
                {/* Background ambient pattern */}
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px',
                  }}
                />

                <div className="relative z-10 max-w-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/25">
                      {slide.badge}
                    </span>
                    <span className="text-[10px] font-bold text-orange-200 uppercase tracking-wider hidden sm:inline">
                      {slide.tagline}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-tight">
                    {slide.title} <span className="text-amber-300">{slide.highlightText}</span>
                  </h2>

                  <p className="text-xs sm:text-sm text-white/90 font-medium leading-relaxed max-w-md line-clamp-2 sm:line-clamp-none">
                    {slide.description}
                  </p>
                </div>

                <div className="relative z-10 pt-3 sm:pt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleSlideAction(slide.actionHandler)}
                    className="px-4 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-orange-50 active:scale-95 text-slate-900 font-extrabold text-xs sm:text-sm transition-all shadow-md flex items-center gap-1.5"
                  >
                    <span>{slide.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-orange-600" />
                  </button>

                  {/* Carousel navigation arrows on desktop */}
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveSlideIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                      className="p-1.5 rounded-full bg-black/20 hover:bg-black/35 text-white transition-colors"
                      aria-label="Previous promotional slide"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length)}
                      className="p-1.5 rounded-full bg-black/20 hover:bg-black/35 text-white transition-colors"
                      aria-label="Next promotional slide"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {HERO_SLIDES.map((slide, idx) => (
              <button
                key={`dot-${slide.id}`}
                onClick={() => setActiveSlideIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeSlideIndex === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 4. FOOD CATEGORY DISCOVERY RAIL (With Circular Visual Food Dishes) */}
      <section aria-label="Food category discovery" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Explore by Food Category
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select dishes to filter nearby counters instantly
            </p>
          </div>

          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg transition-colors"
            >
              Reset to All
            </button>
          )}
        </div>

        {/* Scrollable Category Rail */}
        <div className="relative group">
          <div 
            ref={categoryScrollRef}
            className="flex items-start gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 scroll-smooth"
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const imageUrl = CATEGORY_IMAGE_MAP[cat.id] || CATEGORY_IMAGE_MAP['all'];

              return (
                <button
                  key={cat.id}
                  id={`cat-chip-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="flex flex-col items-center gap-2 shrink-0 group/cat focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-2xl transition-transform active:scale-95"
                >
                  {/* Circular Food Photo */}
                  <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden transition-all duration-200 ${
                    isSelected 
                      ? 'ring-3 ring-orange-600 ring-offset-2 ring-offset-white shadow-md' 
                      : 'border border-slate-200/80 shadow-xs group-hover/cat:border-orange-300'
                  }`}>
                    <img
                      src={imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover/cat:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-orange-600/15 pointer-events-none" />
                    )}
                  </div>

                  {/* Category Name */}
                  <span className={`text-[11px] sm:text-xs font-bold text-center line-clamp-1 max-w-[76px] transition-colors ${
                    isSelected ? 'text-orange-600 font-black' : 'text-slate-700 group-hover/cat:text-slate-900'
                  }`}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. QUICK FILTER CHIPS (Near Me, Open Now, Dine-In, Takeaway, Fast, Pure Veg) */}
      <section aria-label="Discovery filters" className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          
          {/* Active Filters Clear Button */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white shrink-0 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>Clear ({activeFiltersCount})</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Near Me (<= 2km) */}
          <button
            type="button"
            onClick={() => setDistanceFilter(distanceFilter === '2km' ? 'all' : '2km')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
              distanceFilter === '2km'
                ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs font-extrabold'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-orange-600" />
            <span>Near Me (≤ 2 km)</span>
          </button>

          {/* Open Now */}
          <button
            type="button"
            onClick={() => setOnlyOpen(!onlyOpen)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
              onlyOpen
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs font-extrabold'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${onlyOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>Open Now</span>
          </button>

          {/* Dine-In Available */}
          <button
            type="button"
            onClick={() => setOnlyDineIn(!onlyDineIn)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
              onlyDineIn
                ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs font-extrabold'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-orange-600" />
            <span>Dine-in</span>
          </button>

          {/* Ready Fast (≤ 10 mins) */}
          <button
            type="button"
            onClick={() => setOnlyReadyFast(!onlyReadyFast)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
              onlyReadyFast
                ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs font-extrabold'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Ready Fast (≤ 10m)</span>
          </button>

          {/* Pure Veg */}
          <button
            type="button"
            onClick={() => setOnlyVeg(!onlyVeg)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
              onlyVeg
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs font-extrabold'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-xs border border-emerald-600 flex items-center justify-center p-0.2">
              <span className="w-1 h-1 rounded-full bg-emerald-600" />
            </span>
            <span>Pure Veg</span>
          </button>

          {/* Top Rated 4.5+ */}
          <button
            type="button"
            onClick={() => setOnlyTopRated(!onlyTopRated)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
              onlyTopRated
                ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs font-extrabold'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>Top Rated (4.5+)</span>
          </button>
        </div>
      </section>

      {/* 6. POPULAR NEAR YOU (Horizontal Discovery Rail) */}
      {selectedCategory === 'all' && popularNearYou.length > 0 && (
        <section aria-label="Popular near you" className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                <Flame className="w-4 h-4 fill-orange-600 text-orange-600" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Popular Near You
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Highest rated food counters around {activeLocation.area || activeLocation.city}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/shops')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 shrink-0"
            >
              <span>See All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Horizontal scroll container with compact cards */}
          <div 
            ref={popularScrollRef}
            className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0"
          >
            {popularNearYou.map((shop) => (
              <div 
                key={`popular-${shop.id}`}
                className="w-64 sm:w-72 shrink-0"
              >
                <ShopCard
                  shop={shop}
                  isSaved={savedShopIds.includes(shop.id)}
                  onToggleSaved={handleToggleSaved}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. CONTEXTUAL FOOD DISCOVERY SECTION A: Best Vada Pav & Snacks Near You */}
      {selectedCategory === 'all' && vadaPavNearYou.length > 0 && (
        <section aria-label="Best Vada Pav & Snacks" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Store className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Best Vada Pav & Snacks Near You
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Crispy batata vadas, spicy thecha & freshly fried savories
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {vadaPavNearYou.map((shop) => (
              <ShopCard
                key={`vada-${shop.id}`}
                shop={shop}
                isSaved={savedShopIds.includes(shop.id)}
                onToggleSaved={handleToggleSaved}
              />
            ))}
          </div>
        </section>
      )}

      {/* 8. CONTEXTUAL FOOD DISCOVERY SECTION B: Quick Bites Ready in ≤ 10 mins */}
      {selectedCategory === 'all' && quickBitesNearYou.length > 0 && (
        <section aria-label="Quick Bites" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Quick Bites Near You (≤ 10 mins prep)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Fast counter pickup when you are on the go
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {quickBitesNearYou.map((shop) => (
              <ShopCard
                key={`quick-${shop.id}`}
                shop={shop}
                isSaved={savedShopIds.includes(shop.id)}
                onToggleSaved={handleToggleSaved}
              />
            ))}
          </div>
        </section>
      )}

      {/* 9. PRIMARY DISCOVERY SECTION: NEARBY FOOD SPOTS */}
      <section id="nearby-food-spots-section" aria-label="Nearby food spots" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Nearby Food Spots
              </h2>
              <span className="text-xs font-bold bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full">
                {filteredShops.length} available
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Verified local restaurants, food stalls, canteens & snacks counters
            </p>
          </div>

          {/* Mode Switcher: 2 km Walking vs 4 km Bike/Car vs All */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold self-start sm:self-auto border border-slate-200/80">
            <button
              type="button"
              onClick={() => setDistanceFilter('2km')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                distanceFilter === '2km'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🚶 Walking (2 km)</span>
              {shopsUnder2km > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  distanceFilter === '2km' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {shopsUnder2km}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDistanceFilter('4km')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                distanceFilter === '4km'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🛵 Bike / Car (4 km)</span>
              {shopsUnder4km > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  distanceFilter === '4km' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {shopsUnder4km}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDistanceFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                distanceFilter === 'all'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All ({processedShops.length})</span>
            </button>
          </div>
        </div>

        {/* Skeleton Loading State or Empty State or Shop Cards Grid */}
        {loading && filteredShops.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-3 animate-pulse shadow-xs">
                <div className="w-full h-44 rounded-2xl bg-slate-200" />
                <div className="space-y-2">
                  <div className="w-2/3 h-5 rounded bg-slate-200" />
                  <div className="w-1/2 h-3.5 rounded bg-slate-100" />
                </div>
                <div className="pt-2 flex justify-between">
                  <div className="w-20 h-4 rounded bg-slate-100" />
                  <div className="w-16 h-4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
              <Store className="w-8 h-8" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {distanceFilter === '2km'
                  ? 'No food stalls within 2 km walking range'
                  : distanceFilter === '4km'
                  ? 'No food stalls within 4 km vehicle range'
                  : 'No shops match your active filters'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {distanceFilter === '2km'
                  ? `No registered food counters found within 2 km of ${activeLocation.area || activeLocation.city}. Expand to Bike/Car mode to browse up to 4 km.`
                  : 'Try resetting category or dietary filters to view all nearby food counters.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {distanceFilter === '2km' && shopsUnder4km > 0 && (
                <button
                  type="button"
                  onClick={() => setDistanceFilter('4km')}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Bike className="w-4 h-4" />
                  <span>Check Up to 4 km (Bike/Car Mode · {shopsUnder4km} stalls)</span>
                </button>
              )}

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  Reset Active Filters
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCityModalOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-orange-600" />
                <span>Change Area</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
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

      {/* 10. SAVED SHOPS SECTION (If Authenticated or Has Favorites) */}
      {selectedCategory === 'all' && savedShopIds.length > 0 && (
        <section aria-label="Saved stalls" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                My Saved Stalls
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/saved')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700"
            >
              View All ({savedShopIds.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedShops
              .filter(s => savedShopIds.includes(s.id))
              .slice(0, 3)
              .map(shop => (
                <ShopCard
                  key={`saved-${shop.id}`}
                  shop={shop}
                  isSaved={true}
                  onToggleSaved={handleToggleSaved}
                />
              ))}
          </div>
        </section>
      )}

      {/* 11. CITY / LOCATION SELECTOR MODAL */}
      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Select Your Area / City
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Discover authentic street stalls nearby
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCityModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close location picker"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3.5 space-y-3 overflow-y-auto no-scrollbar">
              {/* GPS Auto-Detect Button */}
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={gpsLoading}
                className="w-full p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Navigation className={`w-4 h-4 text-emerald-600 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <div className="text-left">
                    <p className="font-extrabold">Use Current GPS Location</p>
                    <p className="text-[11px] text-emerald-700/80 font-medium">
                      High accuracy satellite lock (≤ 25m)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-600" />
              </button>

              {gpsMessage && (
                <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold text-center">
                  {gpsMessage}
                </p>
              )}

              {/* City Presets Header */}
              <div className="pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Popular Food Hubs
                </span>
              </div>

              {/* City Presets List */}
              <div className="space-y-1.5">
                {INDIAN_CITIES.map((city) => {
                  const isCurrent = activeLocation.city === city.name;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => handleSelectCityPreset(city)}
                      className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'bg-orange-50 border-orange-300 text-orange-950 font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs sm:text-sm">{city.name}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-black bg-orange-600 text-white px-1.5 py-0.2 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {city.popularArea}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
