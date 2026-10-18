import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './database.types';
import { AuthContext, type AuthState } from './auth-context';
import { setStorageOwner } from './storageScope';

interface LoadedProfile {
  userId: string;
  profile: Profile | null;
  error: string;
}

function fetchProfile(id: string) {
  // named columns: the email-derived key on profiles is not readable from the browser
  return supabase
    .from('profiles')
    .select('id, role, full_name, organization, approval, approved_at, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
}

function toLoaded(userId: string, res: Awaited<ReturnType<typeof fetchProfile>>): LoadedProfile {
  return {
    userId,
    profile: res.error ? null : res.data,
    error: res.error ? 'Could not load your profile. Refresh to try again.' : '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const userId = session?.user.id;
  // set before children render, so every browser-storage read in this pass uses this account's keys
  setStorageOwner(userId ?? '');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (id: string) => toLoaded(id, await fetchProfile(id)), []);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    // ignore a late answer if the user changed (signed out or switched account) meanwhile
    fetchProfile(userId).then((res) => {
      if (live) setLoaded(toLoaded(userId, res));
    });
    return () => {
      live = false;
    };
  }, [userId]);

  // the profile belongs to whoever is signed in now; a stale one from a previous user reads as "loading"
  const profile = !userId ? null : loaded?.userId === userId ? loaded.profile : undefined;
  const profileError = loaded?.userId === userId ? (loaded?.error ?? '') : '';

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile: session === undefined ? undefined : profile,
      profileError,
      refreshProfile: async () => {
        if (userId) setLoaded(await loadProfile(userId));
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, profileError, userId, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
