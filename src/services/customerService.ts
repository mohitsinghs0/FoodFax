import { UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

const PROFILE_KEY = 'foodflow_user_profile';

export const customerService = {
  /**
   * Fetch customer profile by user ID or from Supabase session
   */
  async getProfile(customerId?: string): Promise<UserProfile | null> {
    // 1. Try fetching from Supabase database if configured
    if (isSupabaseConfigured) {
      try {
        let targetId = customerId;
        if (!targetId) {
          const { data: { session } } = await supabase.auth.getSession();
          targetId = session?.user?.id;
        }

        if (targetId) {
          // Check dedicated customers table first
          const { data: cust, error: custErr } = await supabase
            .from('customers')
            .select('*')
            .eq('id', targetId)
            .maybeSingle();

          if (!custErr && cust) {
            const profile: UserProfile = {
              id: cust.id,
              name: cust.full_name,
              phone: cust.phone,
              email: cust.email || '',
              savedShopIds: cust.saved_shop_ids || [],
              preferredLocation: cust.preferred_location || cust.area || 'Mumbai',
            };
            localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
            return profile;
          }

          // Check users table as fallback
          const { data: u, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', targetId)
            .maybeSingle();

          if (!userErr && u) {
            const profile: UserProfile = {
              id: u.id,
              name: u.full_name || 'Customer',
              phone: u.phone || '',
              email: u.email || '',
              savedShopIds: [],
              preferredLocation: u.area || 'Mumbai',
            };
            localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
            return profile;
          }
        }
      } catch (err) {
        console.warn('[CustomerService] Error querying customer profile from Supabase:', err);
      }
    }

    // 2. Local storage cache fallback
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }

    return null;
  },

  /**
   * Update customer profile in Supabase customers table & local storage
   */
  async updateProfile(updates: Partial<UserProfile>, customerId?: string): Promise<UserProfile> {
    const current = await this.getProfile(customerId) || {
      id: customerId || 'cust-new',
      name: updates.name || 'Customer',
      phone: updates.phone || '',
      email: updates.email || '',
      savedShopIds: updates.savedShopIds || [],
      preferredLocation: updates.preferredLocation || 'Mumbai',
    };

    const updated: UserProfile = { ...current, ...updates };

    // Sync to Supabase
    if (isSupabaseConfigured && updated.id) {
      const dbPayload = {
        id: updated.id,
        full_name: updated.name,
        phone: updated.phone,
        email: updated.email || null,
        saved_shop_ids: updated.savedShopIds || [],
        preferred_location: updated.preferredLocation,
        updated_at: new Date().toISOString(),
      };

      try {
        await supabase.from('customers').upsert(dbPayload);
      } catch (e) {
        console.warn('[CustomerService] Error upserting to customers table:', e);
      }

      try {
        await supabase.from('users').update({
          full_name: updated.name,
          phone: updated.phone,
          email: updated.email || null,
          updated_at: new Date().toISOString(),
        }).eq('id', updated.id);
      } catch (e) {
        console.warn('[CustomerService] Error updating users table:', e);
      }
    }

    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return updated;
  },
};
