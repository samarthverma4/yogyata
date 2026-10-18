import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from './database.types';

export interface AuthState {
  /** `undefined` while the stored session is still being read */
  session: Session | null | undefined;
  /** `undefined` while loading, `null` when signed out or the row is missing */
  profile: Profile | null | undefined;
  profileError: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
