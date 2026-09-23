import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, OwnerBusinessContext, UserRole } from '../types';
import { authService, DEMO_CUSTOMER, DEMO_OWNER } from '../services/authService';

interface AuthContextType {
  currentUser: AuthUser | null;
  user: AuthUser | null; // Backward compatibility alias
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  currentBusiness: OwnerBusinessContext | null;
  activeShopId: string;
  login: (emailOrPhone: string, password?: string) => Promise<AuthUser>;
  signInWithGoogle: (intendedRole?: 'customer' | 'owner') => Promise<{ user: AuthUser; isNewUser: boolean }>;
  loginAsDemoCustomer: () => Promise<AuthUser>;
  loginAsDemoOwner: () => Promise<AuthUser>;
  registerCustomer: (data: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
  }) => Promise<AuthUser>;
  registerOwner: (data: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
    shopName?: string;
    shopAddress?: string;
    stallType?: string;
  }) => Promise<{ user: AuthUser; shop: OwnerBusinessContext | null }>;
  completeCustomerProfile: (data: {
    fullName: string;
    phone: string;
    latitude: number;
    longitude: number;
    area: string;
    city: string;
    photoUrl?: string;
  }) => Promise<AuthUser>;
  setupOwnerShop: (data: {
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
  }) => Promise<{ user: AuthUser; shop: OwnerBusinessContext }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (data: { fullName: string; phone: string; email?: string }) => Promise<AuthUser>;
  updateAvatar: (photoUri: string) => Promise<AuthUser>;
  removeAvatar: () => Promise<AuthUser>;
  updateOwnerShop: (data: Partial<OwnerBusinessContext>) => Promise<OwnerBusinessContext>;
  setActiveShopId: (shopId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [currentBusiness, setCurrentBusiness] = useState<OwnerBusinessContext | null>(() => authService.getCurrentBusiness());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeShopIdOverride, setActiveShopIdOverride] = useState<string | null>(null);

  // Synchronize state with authService subscriptions
  useEffect(() => {
    const unsubscribe = authService.subscribe((user, business) => {
      setCurrentUser(user);
      setCurrentBusiness(business);
    });

    // Refresh session on mount to ensure persistent remote validation
    authService
      .refreshSession()
      .catch((err) => console.warn('[AuthContext] Session refresh warning:', err))
      .finally(() => setIsLoading(false));

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (emailOrPhone: string, password?: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const res = await authService.login({ emailOrPhone, password });
      setCurrentUser(res.user);
      setCurrentBusiness(res.business || null);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(
    async (intendedRole: 'customer' | 'owner' = 'customer'): Promise<{ user: AuthUser; isNewUser: boolean }> => {
      setIsLoading(true);
      try {
        const res = await authService.signInWithGoogle(intendedRole);
        setCurrentUser(res.user);
        setCurrentBusiness(res.business || null);
        return { user: res.user, isNewUser: res.isNewUser };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const loginAsDemoCustomer = useCallback(async (): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const u = await authService.loginAsDemoCustomer();
      setCurrentUser(u);
      setCurrentBusiness(null);
      return u;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAsDemoOwner = useCallback(async (): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const res = await authService.loginAsDemoOwner();
      setCurrentUser(res.user);
      setCurrentBusiness(res.business);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerCustomer = useCallback(
    async (data: {
      fullName: string;
      phone: string;
      email?: string;
      password: string;
    }): Promise<AuthUser> => {
      setIsLoading(true);
      try {
        const u = await authService.registerCustomer(data);
        setCurrentUser(u);
        setCurrentBusiness(null);
        return u;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const registerOwner = useCallback(
    async (data: {
      fullName: string;
      phone: string;
      email: string;
      password: string;
      shopName?: string;
      shopAddress?: string;
      stallType?: string;
    }): Promise<{ user: AuthUser; shop: OwnerBusinessContext | null }> => {
      setIsLoading(true);
      try {
        const res = await authService.registerOwner(data);
        setCurrentUser(res.user);
        setCurrentBusiness(res.shop);
        return res;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const completeCustomerProfile = useCallback(
    async (data: {
      fullName: string;
      phone: string;
      latitude: number;
      longitude: number;
      area: string;
      city: string;
      photoUrl?: string;
    }): Promise<AuthUser> => {
      setIsLoading(true);
      try {
        const updated = await authService.completeCustomerProfile(data);
        setCurrentUser(updated);
        return updated;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const setupOwnerShop = useCallback(
    async (data: {
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
    }): Promise<{ user: AuthUser; shop: OwnerBusinessContext }> => {
      setIsLoading(true);
      try {
        const res = await authService.setupOwnerShop(data);
        setCurrentUser(res.user);
        setCurrentBusiness(res.shop);
        return res;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setCurrentUser(null);
      setCurrentBusiness(null);
      setActiveShopIdOverride(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    const res = await authService.refreshSession();
    setCurrentUser(res.user);
    setCurrentBusiness(res.business);
  }, []);

  const updateProfile = useCallback(
    async (data: { fullName: string; phone: string; email?: string }): Promise<AuthUser> => {
      const updated = await authService.updateUserProfile(data);
      setCurrentUser(updated);
      return updated;
    },
    []
  );

  const updateAvatar = useCallback(async (photoUri: string): Promise<AuthUser> => {
    const updated = await authService.updateAvatar(photoUri);
    setCurrentUser(updated);
    return updated;
  }, []);

  const removeAvatar = useCallback(async (): Promise<AuthUser> => {
    const updated = await authService.removeAvatar();
    setCurrentUser(updated);
    return updated;
  }, []);

  const updateOwnerShop = useCallback(
    async (data: Partial<OwnerBusinessContext>): Promise<OwnerBusinessContext> => {
      const updated = await authService.updateOwnerShop(data);
      setCurrentBusiness(updated);
      return updated;
    },
    []
  );

  const setActiveShopId = useCallback((shopId: string) => {
    setActiveShopIdOverride(shopId);
  }, []);

  // Compute active shop id for multi-tenant isolation
  const activeShopId = activeShopIdOverride || currentBusiness?.id || currentUser?.shopId || 'demo-shop-001';

  const value: AuthContextType = {
    currentUser,
    user: currentUser, // Alias for backward compatibility
    isAuthenticated: currentUser !== null,
    isLoading,
    role: currentUser ? currentUser.role : null,
    currentBusiness,
    activeShopId,
    login,
    signInWithGoogle,
    loginAsDemoCustomer,
    loginAsDemoOwner,
    registerCustomer,
    registerOwner,
    completeCustomerProfile,
    setupOwnerShop,
    logout,
    refreshSession,
    updateProfile,
    updateAvatar,
    removeAvatar,
    updateOwnerShop,
    setActiveShopId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
