import { UserProfile } from '../types';

const PROFILE_KEY = 'foodflow_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  id: 'cust-1',
  name: 'Mohit Rajput',
  phone: '+91 98765 43210',
  email: 'rajputmohitsingh715@gmail.com',
  savedShopIds: ['sharma-vada-pav', 'college-canteen'],
  preferredLocation: 'Mithibai College / Vile Parle, Mumbai',
};

export const customerService = {
  async getProfile(): Promise<UserProfile> {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return DEFAULT_PROFILE;
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const updated = { ...current, ...updates };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    } catch {
      // fallback
    }
    return updated;
  },
};
