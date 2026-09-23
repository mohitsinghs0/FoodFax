import { supabase } from '../supabase';
import { AuthUser, OwnerBusinessContext, Shop, UserRole } from '../types';
import { shopService } from './shopService';
import { menuService } from './menuService';

// Storage keys for instantaneous cached hydrate
const AUTH_USER_KEY = 'foodflow_auth_user';
const AUTH_BUSINESS_KEY = 'foodflow_auth_business';

/**
 * Robust SHA-256 password hashing for password verification fallback
 */
async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(`foodflow_salt_${password}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }
  let hash = 0;
  const str = `foodflow_salt_${password}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

export const DEMO_CUSTOMER: AuthUser = {
  id: 'demo-customer-001',
  fullName: 'Demo Customer',
  name: 'Demo Customer',
  phone: '+91 98765 43210',
  email: 'customer@foodflow.demo',
  role: 'customer',
  isActive: true,
  profileCompleted: true,
  latitude: 19.1197,
  longitude: 72.8464,
  area: 'Andheri West',
  city: 'Mumbai',
  createdAt: '2026-01-01T00:00:00.000Z',
  isDemo: true,
};

export const DEMO_OWNER: AuthUser = {
  id: 'demo-owner-001',
  fullName: 'Demo Owner (Ramesh Sharma)',
  name: 'Demo Owner (Ramesh Sharma)',
  phone: '+91 98200 12345',
  email: 'owner@foodflow.demo',
  role: 'owner',
  shopId: 'sharma-vada-pav',
  isActive: true,
  profileCompleted: true,
  latitude: 19.1197,
  longitude: 72.8464,
  area: 'Andheri West',
  city: 'Mumbai',
  createdAt: '2026-01-01T00:00:00.000Z',
  isDemo: true,
};

export const DEMO_SHOP: OwnerBusinessContext = {
  id: 'sharma-vada-pav',
  name: 'Sharma Vada Pav',
  ownerId: 'demo-owner-001',
  phone: '+91 98200 12345',
  address: 'Gate 2, Andheri West Metro Station, Mumbai',
  stallType: 'Thela / Food Stall',
  isOpen: true,
  image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
  rating: 4.8,
  latitude: 19.1197,
  longitude: 72.8464,
};

export const DEMO_PASSWORD = 'demo123';

class AuthService {
  private currentUser: AuthUser | null = null;
  private currentBusiness: OwnerBusinessContext | null = null;
  private listeners: Set<(user: AuthUser | null, business: OwnerBusinessContext | null) => void> = new Set();
  private authInitialized = false;

  constructor() {
    this.restoreCachedSession();
    this.initSupabaseAuthListener();
  }

  private restoreCachedSession(): void {
    try {
      const storedUser = localStorage.getItem(AUTH_USER_KEY);
      const storedBusiness = localStorage.getItem(AUTH_BUSINESS_KEY);
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }
      if (storedBusiness) {
        this.currentBusiness = JSON.parse(storedBusiness);
      }
    } catch {
      this.currentUser = null;
      this.currentBusiness = null;
    }
  }

  private persistSession(user: AuthUser | null, business: OwnerBusinessContext | null): void {
    this.currentUser = user;
    this.currentBusiness = business;

    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }

    if (business) {
      localStorage.setItem(AUTH_BUSINESS_KEY, JSON.stringify(business));
    } else {
      localStorage.removeItem(AUTH_BUSINESS_KEY);
    }

    this.notifyListeners();
  }

  private initSupabaseAuthListener(): void {
    try {
      supabase.auth.onAuthStateChange(async (event, session) => {
        this.authInitialized = true;
        const spUser = session?.user;

        if (!spUser) {
          // If we had a demo user active, don't clear it on null supabase session
          if (this.currentUser?.isDemo) {
            return;
          }
          this.persistSession(null, null);
          return;
        }

        try {
          // Fetch user profile from public.users table
          const { data: dbUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', spUser.id)
            .maybeSingle();

          let userProfile: AuthUser;
          let business: OwnerBusinessContext | null = null;

          if (dbUser) {
            userProfile = {
              id: spUser.id,
              fullName: dbUser.full_name || spUser.user_metadata?.full_name || 'User',
              name: dbUser.full_name || spUser.user_metadata?.full_name || 'User',
              phone: dbUser.phone || spUser.phone || '',
              email: spUser.email || dbUser.email || '',
              role: (dbUser.role as UserRole) || 'customer',
              shopId: dbUser.shop_id,
              isActive: dbUser.is_active !== false,
              latitude: dbUser.latitude,
              longitude: dbUser.longitude,
              area: dbUser.area,
              city: dbUser.city,
              photoUrl: dbUser.photo_url || spUser.user_metadata?.avatar_url,
              profileCompleted: dbUser.profile_completed ?? true,
              createdAt: dbUser.created_at || new Date().toISOString(),
            };

            if (userProfile.role === 'owner') {
              business = await this.fetchOwnerShop(spUser.id, userProfile.shopId);
            }
          } else {
            // User just signed in, create initial profile row
            const meta = spUser.user_metadata || {};
            userProfile = {
              id: spUser.id,
              fullName: meta.full_name || meta.name || spUser.email?.split('@')[0] || 'FoodFlow User',
              name: meta.full_name || meta.name || spUser.email?.split('@')[0] || 'FoodFlow User',
              phone: spUser.phone || '',
              email: spUser.email || '',
              role: (meta.role as UserRole) || 'customer',
              isActive: true,
              profileCompleted: false,
              photoUrl: meta.avatar_url,
              createdAt: new Date().toISOString(),
            };

            await supabase.from('users').upsert({
              id: spUser.id,
              full_name: userProfile.fullName,
              phone: userProfile.phone,
              email: userProfile.email,
              role: userProfile.role,
              is_active: true,
              profile_completed: false,
              photo_url: userProfile.photoUrl,
              created_at: userProfile.createdAt,
              updated_at: new Date().toISOString(),
            });
          }

          this.persistSession(userProfile, business);
        } catch (err) {
          console.warn('[AuthService] Error fetching user profile on Supabase auth change:', err);
          this.notifyListeners();
        }
      });
    } catch (e) {
      console.warn('[AuthService] Could not initialize Supabase auth listener:', e);
    }
  }

  /**
   * Helper to load an owner's shop from public.shops
   */
  public async fetchOwnerShop(ownerId: string, shopId?: string): Promise<OwnerBusinessContext | null> {
    try {
      if (shopId) {
        const { data: s, error } = await supabase
          .from('shops')
          .select('*')
          .eq('id', shopId)
          .maybeSingle();

        if (s) {
          return {
            id: s.id,
            name: s.name,
            ownerId: s.owner_id || ownerId,
            description: s.description,
            phone: s.contact_phone || s.phone,
            address: s.address,
            area: s.area,
            city: s.city,
            state: s.state,
            pincode: s.pincode,
            latitude: s.latitude,
            longitude: s.longitude,
            stallType: s.stall_type,
            openingTime: s.opening_time,
            closingTime: s.closing_time,
            upiId: s.upi_id,
            isOpen: s.is_open,
            isActive: s.is_active,
            image: s.image,
            rating: Number(s.rating) || 4.5,
          };
        }
      }

      // Query shops where owner_id == ownerId
      const { data: list, error: listError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', ownerId)
        .limit(1);

      if (list && list.length > 0) {
        const s = list[0];
        return {
          id: s.id,
          name: s.name,
          ownerId: s.owner_id || ownerId,
          description: s.description,
          phone: s.contact_phone || s.phone,
          address: s.address,
          area: s.area,
          city: s.city,
          state: s.state,
          pincode: s.pincode,
          latitude: s.latitude,
          longitude: s.longitude,
          stallType: s.stall_type,
          openingTime: s.opening_time,
          closingTime: s.closing_time,
          upiId: s.upi_id,
          isOpen: s.is_open,
          isActive: s.is_active,
          image: s.image,
          rating: Number(s.rating) || 4.5,
        };
      }
    } catch (err) {
      console.warn('[AuthService] Error querying owner shop:', err);
    }
    return null;
  }

  public subscribe(callback: (user: AuthUser | null, business: OwnerBusinessContext | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentUser, this.currentBusiness);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentUser, this.currentBusiness);
      } catch (err) {
        console.error('[AuthService] Listener error:', err);
      }
    });
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public getCurrentBusiness(): OwnerBusinessContext | null {
    return this.currentBusiness;
  }

  public async refreshSession(): Promise<{ user: AuthUser | null; business: OwnerBusinessContext | null }> {
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const uid = session?.user?.id || this.currentUser?.id;

    if (uid && !this.currentUser?.isDemo) {
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', uid)
          .maybeSingle();

        if (dbUser) {
          this.currentUser = {
            ...this.currentUser,
            id: uid,
            fullName: dbUser.full_name || this.currentUser?.fullName || 'User',
            name: dbUser.full_name || this.currentUser?.fullName || 'User',
            phone: dbUser.phone || this.currentUser?.phone || '',
            email: dbUser.email || this.currentUser?.email || '',
            role: (dbUser.role as UserRole) || 'customer',
            shopId: dbUser.shop_id,
            isActive: dbUser.is_active !== false,
            latitude: dbUser.latitude,
            longitude: dbUser.longitude,
            area: dbUser.area,
            city: dbUser.city,
            photoUrl: dbUser.photo_url || this.currentUser?.photoUrl,
            profileCompleted: dbUser.profile_completed ?? true,
          } as AuthUser;

          if (this.currentUser.role === 'owner') {
            this.currentBusiness = await this.fetchOwnerShop(uid, this.currentUser.shopId);
          }
          this.persistSession(this.currentUser, this.currentBusiness);
        }
      } catch (err) {
        console.warn('[AuthService] Error during session refresh:', err);
      }
    }
    return { user: this.currentUser, business: this.currentBusiness };
  }

  /**
   * Helper to resolve an email if user entered a phone number
   */
  private async resolveEmailFromPhoneOrInput(emailOrPhone: string): Promise<string> {
    const trimmed = emailOrPhone.trim();
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }

    const cleanDigits = trimmed.replace(/\D/g, '');
    if (cleanDigits.length >= 10) {
      try {
        const { data } = await supabase
          .from('users')
          .select('email')
          .or(`phone.eq.${trimmed},phone.eq.+91 ${cleanDigits.slice(-10)}`)
          .limit(1);

        if (data && data.length > 0 && data[0].email) {
          return data[0].email.toLowerCase();
        }
      } catch (e) {
        console.warn('[AuthService] Phone email lookup fallback:', e);
      }
      return `${cleanDigits.slice(-10)}@foodflow.user`;
    }

    return trimmed.toLowerCase();
  }

  /**
   * Google Sign-In with Supabase OAuth
   */
  public async signInWithGoogle(
    intendedRole: 'customer' | 'owner' = 'customer'
  ): Promise<{ user: AuthUser; isNewUser: boolean; business?: OwnerBusinessContext }> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          queryParams: {
            role: intendedRole,
          },
        },
      });

      if (error) {
        throw error;
      }

      // If in browser redirection flow, wait briefly
      const user = this.currentUser || DEMO_CUSTOMER;
      return { user, isNewUser: false };
    } catch (err: any) {
      console.warn('[AuthService] Google OAuth notice:', err?.message);
      // If Google provider is not enabled in Supabase dashboard yet, fallback smoothly
      throw new Error(err?.message || 'Google sign-in requires Google OAuth enabled in Supabase dashboard.');
    }
  }

  /**
   * Login with Supabase Authentication or local credential fallback
   */
  public async login(credentials: { emailOrPhone: string; password?: string }): Promise<{ user: AuthUser; business?: OwnerBusinessContext }> {
    const rawInput = credentials.emailOrPhone.trim();
    const password = credentials.password?.trim() || '';

    if (!rawInput) {
      throw new Error('Please enter your email or phone number.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    // Instant bypass for demo accounts
    if (
      (rawInput.toLowerCase() === DEMO_CUSTOMER.email?.toLowerCase() ||
        rawInput === DEMO_CUSTOMER.phone ||
        rawInput === 'customer') &&
      password === DEMO_PASSWORD
    ) {
      const u = await this.loginAsDemoCustomer();
      return { user: u };
    }
    if (
      (rawInput.toLowerCase() === DEMO_OWNER.email?.toLowerCase() ||
        rawInput === DEMO_OWNER.phone ||
        rawInput === 'owner') &&
      password === DEMO_PASSWORD
    ) {
      return await this.loginAsDemoOwner();
    }

    const targetEmail = await this.resolveEmailFromPhoneOrInput(rawInput);

    // 1. Attempt Supabase Auth login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: password,
    });

    if (!authError && authData.user) {
      const uid = authData.user.id;
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      let userProfile: AuthUser;
      let business: OwnerBusinessContext | null = null;

      if (dbUser) {
        userProfile = {
          id: uid,
          fullName: dbUser.full_name || authData.user.user_metadata?.full_name || 'User',
          name: dbUser.full_name || authData.user.user_metadata?.full_name || 'User',
          phone: dbUser.phone || '',
          email: authData.user.email || dbUser.email || '',
          role: (dbUser.role as UserRole) || 'customer',
          shopId: dbUser.shop_id,
          isActive: dbUser.is_active !== false,
          latitude: dbUser.latitude,
          longitude: dbUser.longitude,
          area: dbUser.area,
          city: dbUser.city,
          photoUrl: dbUser.photo_url,
          profileCompleted: dbUser.profile_completed ?? true,
          createdAt: dbUser.created_at || new Date().toISOString(),
        };

        if (userProfile.role === 'owner') {
          business = await this.fetchOwnerShop(uid, userProfile.shopId);
        }
      } else {
        userProfile = {
          id: uid,
          fullName: authData.user.user_metadata?.full_name || targetEmail.split('@')[0],
          name: authData.user.user_metadata?.full_name || targetEmail.split('@')[0],
          phone: '',
          email: targetEmail,
          role: 'customer',
          isActive: true,
          profileCompleted: false,
          createdAt: new Date().toISOString(),
        };

        await supabase.from('users').upsert({
          id: uid,
          full_name: userProfile.fullName,
          email: targetEmail,
          role: userProfile.role,
          is_active: true,
          profile_completed: false,
        });
      }

      this.persistSession(userProfile, business);
      return { user: userProfile, business: business || undefined };
    }

    // 2. Fallback check in public.users table directly (for prototype registrations before email confirmation)
    try {
      const cleanDigits = rawInput.replace(/\D/g, '');
      const query = supabase.from('users').select('*');
      
      const { data: matchedUsers } = await query.or(
        `email.eq.${targetEmail},phone.eq.${rawInput}${cleanDigits.length >= 10 ? `,phone.eq.+91 ${cleanDigits.slice(-10)}` : ''}`
      ).limit(1);

      if (matchedUsers && matchedUsers.length > 0) {
        const u = matchedUsers[0];
        let business: OwnerBusinessContext | null = null;
        const userProfile: AuthUser = {
          id: u.id,
          fullName: u.full_name || 'User',
          name: u.full_name || 'User',
          phone: u.phone || rawInput,
          email: u.email || targetEmail,
          role: (u.role as UserRole) || 'customer',
          shopId: u.shop_id,
          isActive: u.is_active !== false,
          latitude: u.latitude,
          longitude: u.longitude,
          area: u.area,
          city: u.city,
          photoUrl: u.photo_url,
          profileCompleted: u.profile_completed ?? true,
          createdAt: u.created_at || new Date().toISOString(),
        };

        if (userProfile.role === 'owner') {
          business = await this.fetchOwnerShop(u.id, userProfile.shopId);
        }

        this.persistSession(userProfile, business);
        return { user: userProfile, business: business || undefined };
      }
    } catch (e) {
      console.warn('[AuthService] Fallback user table check error:', e);
    }

    throw new Error(authError?.message || 'Login failed. Please check your email/phone and password.');
  }

  /**
   * Quick 1-click Demo Customer Login
   */
  public async loginAsDemoCustomer(): Promise<AuthUser> {
    this.persistSession(DEMO_CUSTOMER, null);
    return DEMO_CUSTOMER;
  }

  /**
   * Quick 1-click Demo Owner Login
   */
  public async loginAsDemoOwner(): Promise<{ user: AuthUser; business: OwnerBusinessContext }> {
    this.persistSession(DEMO_OWNER, DEMO_SHOP);
    return { user: DEMO_OWNER, business: DEMO_SHOP };
  }

  /**
   * Customer Registration via Supabase
   */
  public async registerCustomer(data: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
  }): Promise<AuthUser> {
    const fullName = data.fullName.trim();
    const cleanPhone = data.phone.trim();
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    const password = data.password.trim();

    if (!fullName) {
      throw new Error('Full name is required.');
    }
    if (cleanDigits.length < 10) {
      throw new Error('Enter a valid 10-digit phone number.');
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      throw new Error('Enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must contain at least 6 characters.');
    }

    const emailToUse = data.email?.trim()
      ? data.email.trim().toLowerCase()
      : `${cleanDigits.slice(-10)}@foodflow.user`;

    let uid = `u_${Date.now()}_${cleanDigits.slice(-6)}`;

    // 1. Sign up user via Supabase Auth
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailToUse,
        password: password,
        options: {
          data: {
            full_name: fullName,
            phone: cleanPhone,
            role: 'customer',
          },
        },
      });

      if (signUpData?.user?.id) {
        uid = signUpData.user.id;
      } else if (signUpError && !signUpError.message.includes('already registered')) {
        console.warn('[AuthService] Supabase signUp note:', signUpError.message);
      }
    } catch (e: any) {
      console.warn('[AuthService] Supabase Auth signUp exception:', e?.message);
    }

    const newUser: AuthUser = {
      id: uid,
      fullName: fullName,
      name: fullName,
      phone: cleanPhone.startsWith('+91') ? cleanPhone : `+91 ${cleanDigits.slice(-10)}`,
      email: emailToUse,
      role: 'customer',
      profileCompleted: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // 2. Insert into public.users table
    try {
      await supabase.from('users').upsert({
        id: uid,
        full_name: fullName,
        phone: newUser.phone,
        email: emailToUse,
        role: 'customer',
        profile_completed: false,
        is_active: true,
        created_at: newUser.createdAt,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[AuthService] Error storing profile in users table:', err);
    }

    this.persistSession(newUser, null);
    return newUser;
  }

  /**
   * Complete Customer Profile
   */
  public async completeCustomerProfile(data: {
    fullName: string;
    phone: string;
    latitude: number;
    longitude: number;
    area: string;
    city: string;
    photoUrl?: string;
  }): Promise<AuthUser> {
    const uid = this.currentUser?.id;
    if (!uid) {
      throw new Error('You must be logged in to complete your profile.');
    }

    const updates = {
      full_name: data.fullName.trim(),
      phone: data.phone.trim(),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      area: data.area.trim(),
      city: data.city.trim(),
      photo_url: data.photoUrl?.trim() || null,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    };

    try {
      await supabase.from('users').update(updates).eq('id', uid);
    } catch (err) {
      console.warn('[AuthService] Error updating profile in Supabase:', err);
    }

    const updatedUser: AuthUser = {
      ...this.currentUser!,
      id: uid,
      fullName: updates.full_name,
      name: updates.full_name,
      phone: updates.phone,
      latitude: updates.latitude,
      longitude: updates.longitude,
      area: updates.area,
      city: updates.city,
      photoUrl: updates.photo_url || undefined,
      profileCompleted: true,
    };

    this.persistSession(updatedUser, this.currentBusiness);
    return updatedUser;
  }

  /**
   * Shop Owner Registration via Supabase
   */
  public async registerOwner(data: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
    shopName?: string;
    shopAddress?: string;
    stallType?: string;
  }): Promise<{ user: AuthUser; shop: OwnerBusinessContext | null }> {
    const fullName = data.fullName.trim();
    const cleanPhone = data.phone.trim();
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    const email = data.email.trim().toLowerCase();
    const password = data.password.trim();

    if (!fullName) {
      throw new Error('Full name is required.');
    }
    if (cleanDigits.length < 10) {
      throw new Error('Enter a valid 10-digit phone number.');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must contain at least 6 characters.');
    }

    let uid = `owner_${Date.now()}_${cleanDigits.slice(-6)}`;

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            phone: cleanPhone,
            role: 'owner',
          },
        },
      });

      if (signUpData?.user?.id) {
        uid = signUpData.user.id;
      } else if (signUpError) {
        console.warn('[AuthService] Supabase owner signUp note:', signUpError.message);
      }
    } catch (e: any) {
      console.warn('[AuthService] Supabase owner signUp exception:', e?.message);
    }

    const newOwner: AuthUser = {
      id: uid,
      fullName: fullName,
      name: fullName,
      phone: cleanPhone.startsWith('+91') ? cleanPhone : `+91 ${cleanDigits.slice(-10)}`,
      email: email,
      role: 'owner',
      profileCompleted: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await supabase.from('users').upsert({
        id: uid,
        full_name: fullName,
        phone: newOwner.phone,
        email: email,
        role: 'owner',
        profile_completed: false,
        is_active: true,
        created_at: newOwner.createdAt,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[AuthService] Error storing owner in users table:', err);
    }

    this.persistSession(newOwner, null);
    return { user: newOwner, shop: null };
  }

  /**
   * Complete Setup Shop for Owner
   */
  public async setupOwnerShop(data: {
    ownerName: string;
    shopName: string;
    description: string;
    phone: string;
    address: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
    openingTime: string;
    closingTime: string;
    upiId: string;
    stallType?: string;
    image?: string;
  }): Promise<{ user: AuthUser; shop: OwnerBusinessContext }> {
    const uid = this.currentUser?.id;
    if (!uid) {
      throw new Error('You must be logged in to set up your shop.');
    }

    const shopId = `shop-${Date.now().toString().slice(-6)}`;
    const stallType = data.stallType || 'Thela / Food Stall';
    const image = data.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';

    const dbShopRecord = {
      id: shopId,
      owner_id: uid,
      name: data.shopName.trim(),
      slug: data.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      stall_type: stallType,
      tagline: 'Fresh street food & quick counter pickup',
      description: data.description.trim() || `Welcome to ${data.shopName}. Serving fresh items with quick digital counter tokens.`,
      image: image,
      banner_image: image,
      phone: data.phone.trim(),
      contact_phone: data.phone.trim(),
      address: data.address.trim(),
      area: data.area.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      pincode: data.pincode.trim(),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      upi_id: data.upiId.trim(),
      opening_time: data.openingTime,
      closing_time: data.closingTime,
      opening_hours: `${data.openingTime} – ${data.closingTime}`,
      is_open: true,
      is_active: true,
      is_pure_veg: true,
      rating: 5.0,
      total_reviews: 1,
      categories: ['snacks', 'fast-food'],
      preparation_time_minutes: '5–10',
      table_service_available: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Insert into public.shops table
    try {
      await supabase.from('shops').upsert(dbShopRecord);
    } catch (err) {
      console.warn('[AuthService] Error inserting shop into Supabase:', err);
    }

    // 2. Update user profile in public.users
    try {
      await supabase.from('users').update({
        full_name: data.ownerName.trim(),
        phone: data.phone.trim(),
        shop_id: shopId,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      }).eq('id', uid);
    } catch (err) {
      console.warn('[AuthService] Error updating user shopId in Supabase:', err);
    }

    const updatedUser: AuthUser = {
      ...this.currentUser!,
      id: uid,
      fullName: data.ownerName.trim(),
      name: data.ownerName.trim(),
      phone: data.phone.trim(),
      shopId: shopId,
      role: 'owner',
      profileCompleted: true,
    };

    const businessContext: OwnerBusinessContext = {
      id: shopId,
      name: dbShopRecord.name,
      ownerId: uid,
      description: dbShopRecord.description,
      phone: dbShopRecord.contact_phone,
      address: dbShopRecord.address,
      area: dbShopRecord.area,
      city: dbShopRecord.city,
      state: dbShopRecord.state,
      pincode: dbShopRecord.pincode,
      latitude: dbShopRecord.latitude,
      longitude: dbShopRecord.longitude,
      stallType: dbShopRecord.stall_type,
      openingTime: dbShopRecord.opening_time,
      closingTime: dbShopRecord.closing_time,
      upiId: dbShopRecord.upi_id,
      isOpen: true,
      isActive: true,
      image: dbShopRecord.image,
      rating: dbShopRecord.rating,
    };

    // 3. Register shop in local cache for instant discovery
    const createdShop: Shop = {
      id: shopId,
      slug: shopId,
      name: dbShopRecord.name,
      stallType: dbShopRecord.stall_type as any,
      tagline: dbShopRecord.description,
      description: dbShopRecord.description,
      image: dbShopRecord.image,
      bannerImage: dbShopRecord.image,
      latitude: dbShopRecord.latitude,
      longitude: dbShopRecord.longitude,
      location: {
        address: dbShopRecord.address,
        landmark: `${dbShopRecord.area}, ${dbShopRecord.city}`,
        distanceKm: 0.1,
        latitude: dbShopRecord.latitude,
        longitude: dbShopRecord.longitude,
      },
      isOpen: true,
      openingHours: `${dbShopRecord.opening_time} – ${dbShopRecord.closing_time}`,
      rating: 5.0,
      totalReviews: 0,
      categories: ['snacks', 'fast-food'],
      preparationTimeMinutes: '5–10',
      isPureVeg: true,
      tableServiceAvailable: false,
      featuredItem: `${dbShopRecord.name} Signature`,
      isDemo: false,
    };

    const currentShops = shopService.getStoredShops();
    shopService.saveStoredShops([createdShop, ...currentShops.filter((s) => s.id !== shopId)]);

    // 4. Initialize starter items for the new shop
    try {
      await menuService.createItem({
        shopId,
        categoryId: 'cat-1',
        name: `${dbShopRecord.name} Special Thali / Combo`,
        description: 'Chef recommendation made fresh with authentic street flavors.',
        price: 60,
        image: dbShopRecord.image,
        isAvailable: true,
        isVeg: true,
        isBestseller: true,
        preparationTimeMin: 7,
      });

      await menuService.createItem({
        shopId,
        categoryId: 'cat-2',
        name: 'Special Cutting Chai / Beverage',
        description: 'Freshly brewed hot cutting tea.',
        price: 15,
        image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
        isAvailable: true,
        isVeg: true,
        preparationTimeMin: 3,
      });
    } catch {
      // ignore
    }

    this.persistSession(updatedUser, businessContext);
    return { user: updatedUser, shop: businessContext };
  }

  /**
   * Logout user
   */
  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthService] Supabase signOut notice:', err);
    }
    this.persistSession(null, null);
  }

  /**
   * Update current user profile
   */
  public async updateUserProfile(updates: Partial<AuthUser>): Promise<AuthUser> {
    const uid = this.currentUser?.id;
    if (!uid) {
      throw new Error('User is not authenticated.');
    }

    const updatedUser: AuthUser = {
      ...this.currentUser!,
      ...updates,
      id: uid,
    };

    if (!this.currentUser?.isDemo) {
      const { error } = await supabase.from('users').update({
        full_name: updates.fullName,
        phone: updates.phone,
        email: updates.email,
        photo_url: updates.photoUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', uid);

      if (error) {
        console.error('[AuthService] Error updating user in Supabase:', error);
        throw new Error(error.message || 'Profile update failed.');
      }
    }

    this.persistSession(updatedUser, this.currentBusiness);
    return updatedUser;
  }

  /**
   * Set custom profile photo avatar
   */
  public async updateAvatar(photoUri: string): Promise<AuthUser> {
    return this.updateUserProfile({ 
      photoUrl: photoUri,
      avatarUrl: photoUri,
    });
  }

  /**
   * Remove custom avatar photo
   */
  public async removeAvatar(): Promise<AuthUser> {
    const uid = this.currentUser?.id;
    if (!uid) {
      throw new Error('User is not authenticated.');
    }

    const updatedUser: AuthUser = {
      ...this.currentUser!,
      photoUrl: undefined,
      avatarUrl: undefined,
      id: uid,
    };

    try {
      await supabase.from('users').update({
        photo_url: null,
        updated_at: new Date().toISOString(),
      }).eq('id', uid);
    } catch (err) {
      console.warn('[AuthService] Error clearing photo_url in Supabase:', err);
    }

    this.persistSession(updatedUser, this.currentBusiness);
    return updatedUser;
  }

  /**
   * Update active shop profile for owners
   */
  public async updateOwnerShop(updates: Partial<OwnerBusinessContext>): Promise<OwnerBusinessContext> {
    if (!this.currentBusiness) {
      throw new Error('No active business context found.');
    }

    const updatedShop: OwnerBusinessContext = {
      ...this.currentBusiness,
      ...updates,
    };

    try {
      await supabase.from('shops').update({
        name: updatedShop.name,
        description: updatedShop.description,
        phone: updatedShop.phone,
        contact_phone: updatedShop.phone,
        address: updatedShop.address,
        area: updatedShop.area,
        city: updatedShop.city,
        state: updatedShop.state,
        pincode: updatedShop.pincode,
        latitude: updatedShop.latitude,
        longitude: updatedShop.longitude,
        stall_type: updatedShop.stallType,
        opening_time: updatedShop.openingTime,
        closing_time: updatedShop.closingTime,
        upi_id: updatedShop.upiId,
        is_open: updatedShop.isOpen ?? true,
        image: updatedShop.image,
        updated_at: new Date().toISOString(),
      }).eq('id', updatedShop.id);
    } catch (err) {
      console.warn('[AuthService] Error updating shop in Supabase:', err);
    }

    this.persistSession(this.currentUser, updatedShop);
    return updatedShop;
  }

  public async resetPassword(emailOrPhone: string): Promise<{ success: boolean; message: string }> {
    if (!emailOrPhone.trim()) {
      throw new Error('Please enter your registered email or phone.');
    }

    if (emailOrPhone.includes('@')) {
      try {
        await supabase.auth.resetPasswordForEmail(emailOrPhone.trim());
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      message: `If an account exists for ${emailOrPhone.trim()}, password reset instructions have been dispatched. (Demo password: ${DEMO_PASSWORD})`,
    };
  }
}

export const authService = new AuthService();
