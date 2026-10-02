/**
 * Cookie Service for FoodFax Persistent Device Sessions
 *
 * Implements persistent device authentication via browser cookies with:
 * - 30-day automatic expiration limit for security
 * - Sliding expiration refresh on active device usage
 * - SameSite=Lax protection against CSRF
 * - Automatic HTTPS Secure flag in production
 * - Clean deletion on explicit user logout
 */

import { AuthUser, OwnerBusinessContext, UserRole } from '../types';

export const SESSION_COOKIE_NAME = 'foodfax_auth_session';
export const SESSION_USER_DATA_KEY = 'foodflow_auth_user';
export const SESSION_BIZ_DATA_KEY = 'foodflow_auth_business';

// 30 Days default session security limit
export const DEFAULT_SESSION_DAYS = 30;
export const DEFAULT_SESSION_MS = DEFAULT_SESSION_DAYS * 24 * 60 * 60 * 1000;

export interface SessionCookiePayload {
  userId: string;
  email: string;
  phone: string;
  role: UserRole;
  shopId?: string;
  fullName: string;
  isDemo?: boolean;
  createdAt: number;
  expiresAt: number;
}

/**
 * Standard Browser Cookie Helpers
 */
export function setCookie(name: string, value: string, days: number = DEFAULT_SESSION_DAYS): void {
  if (typeof document === 'undefined') return;

  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);

  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const encodedValue = encodeURIComponent(value);

  document.cookie = `${name}=${encodedValue};expires=${date.toUTCString()};path=/;SameSite=Lax${isSecure ? ';Secure' : ''}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      } catch {
        return c.substring(nameEQ.length, c.length);
      }
    }
  }

  return null;
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;

  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;Max-Age=0${isSecure ? ';Secure' : ''}`;
}

/**
 * High-Level Session Cookie Operations
 */
export const cookieService = {
  /**
   * Saves or updates persistent device session in cookies and local storage.
   * By default, persists for 30 days unless user logs out.
   */
  saveAuthSession(
    user: AuthUser,
    business: OwnerBusinessContext | null,
    days: number = DEFAULT_SESSION_DAYS
  ): void {
    if (typeof window === 'undefined' || !user || !user.id) return;

    const now = Date.now();
    const expiresAt = now + days * 24 * 60 * 60 * 1000;

    const payload: SessionCookiePayload = {
      userId: user.id,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'customer',
      shopId: user.shopId,
      fullName: user.fullName || user.name || 'User',
      isDemo: Boolean(user.isDemo),
      createdAt: now,
      expiresAt,
    };

    // 1. Write lightweight, secure cookie
    setCookie(SESSION_COOKIE_NAME, JSON.stringify(payload), days);

    // 2. Synchronize full profile in storage with expiry tag
    try {
      localStorage.setItem(SESSION_USER_DATA_KEY, JSON.stringify({ ...user, _sessionExpiresAt: expiresAt }));
      if (business) {
        localStorage.setItem(SESSION_BIZ_DATA_KEY, JSON.stringify(business));
      } else {
        localStorage.removeItem(SESSION_BIZ_DATA_KEY);
      }
    } catch {
      // ignore
    }
  },

  /**
   * Reads persistent device session cookie.
   * If session is expired, clears cookie and returns null.
   * If session is valid, extends expiration (sliding window) and returns session info.
   */
  getAuthSession(): {
    payload: SessionCookiePayload;
    cachedUser: AuthUser | null;
    cachedBusiness: OwnerBusinessContext | null;
  } | null {
    if (typeof window === 'undefined') return null;

    const cookieRaw = getCookie(SESSION_COOKIE_NAME);
    let payload: SessionCookiePayload | null = null;

    if (cookieRaw) {
      try {
        payload = JSON.parse(cookieRaw);
      } catch {
        payload = null;
      }
    }

    // Check localStorage fallback if cookie was cleared or first load
    let cachedUser: AuthUser | null = null;
    let cachedBusiness: OwnerBusinessContext | null = null;

    try {
      const storedUserRaw = localStorage.getItem(SESSION_USER_DATA_KEY);
      const storedBizRaw = localStorage.getItem(SESSION_BIZ_DATA_KEY);

      if (storedUserRaw) {
        cachedUser = JSON.parse(storedUserRaw);
      }
      if (storedBizRaw) {
        cachedBusiness = JSON.parse(storedBizRaw);
      }
    } catch {
      // ignore
    }

    // If neither exists, no active session
    if (!payload && !cachedUser) {
      return null;
    }

    const now = Date.now();

    // Check expiration if present in payload or cached user
    const expiresAt = payload?.expiresAt || (cachedUser as any)?._sessionExpiresAt;
    if (expiresAt && now > expiresAt) {
      // Session has strictly expired! Security limit reached
      this.clearAuthSession();
      return null;
    }

    // If payload exists and is valid, slide/extend the cookie expiration (+30 days)
    if (payload && payload.userId) {
      const extendedExpiresAt = now + DEFAULT_SESSION_MS;
      payload.expiresAt = extendedExpiresAt;
      setCookie(SESSION_COOKIE_NAME, JSON.stringify(payload), DEFAULT_SESSION_DAYS);

      if (cachedUser) {
        (cachedUser as any)._sessionExpiresAt = extendedExpiresAt;
        try {
          localStorage.setItem(SESSION_USER_DATA_KEY, JSON.stringify(cachedUser));
        } catch {}
      }

      return {
        payload,
        cachedUser,
        cachedBusiness,
      };
    }

    // Fallback if only cachedUser exists (e.g. from previous login before cookie service)
    if (cachedUser && cachedUser.id) {
      const fallbackPayload: SessionCookiePayload = {
        userId: cachedUser.id,
        email: cachedUser.email || '',
        phone: cachedUser.phone || '',
        role: cachedUser.role || 'customer',
        shopId: cachedUser.shopId,
        fullName: cachedUser.fullName || cachedUser.name || 'User',
        isDemo: Boolean(cachedUser.isDemo),
        createdAt: now,
        expiresAt: now + DEFAULT_SESSION_MS,
      };

      setCookie(SESSION_COOKIE_NAME, JSON.stringify(fallbackPayload), DEFAULT_SESSION_DAYS);

      return {
        payload: fallbackPayload,
        cachedUser,
        cachedBusiness,
      };
    }

    return null;
  },

  /**
   * Completely destroys cookie and local session on explicit user logout
   */
  clearAuthSession(): void {
    if (typeof window === 'undefined') return;

    deleteCookie(SESSION_COOKIE_NAME);

    try {
      localStorage.removeItem(SESSION_USER_DATA_KEY);
      localStorage.removeItem(SESSION_BIZ_DATA_KEY);
    } catch {
      // ignore
    }
  },

  /**
   * Checks whether the user has a valid, non-expired session cookie
   */
  hasValidSession(): boolean {
    return this.getAuthSession() !== null;
  },
};
