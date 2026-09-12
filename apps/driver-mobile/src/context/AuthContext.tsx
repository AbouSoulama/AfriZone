import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getDriverForUser, type DriverProfile } from '../services/drivers';
import { fetchProfileAvatar, fetchProfileName } from '../services/profile';

const ONLINE_KEY = 'afrizone.driver.online';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  driver: DriverProfile | null;
  avatarUrl: string | null;
  fullName: string | null;
  loading: boolean;
  online: boolean;
  setOnline: (value: boolean) => Promise<void>;
  setAvatarUrl: (url: string | null) => void;
  refreshDriver: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnlineState] = useState(false);

  const loadDriver = useCallback(async (userId: string) => {
    const profile = await getDriverForUser(userId);
    setDriver(profile);
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setAvatarUrl(null);
      setFullName(null);
      return;
    }
    const [avatar, name] = await Promise.all([
      fetchProfileAvatar(userId),
      fetchProfileName(userId),
    ]);
    setAvatarUrl(avatar);
    setFullName(name);
  }, [session?.user?.id]);

  const refreshDriver = useCallback(async () => {
    if (!session?.user?.id) {
      setDriver(null);
      return;
    }
    await loadDriver(session.user.id);
  }, [loadDriver, session?.user?.id]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [{ data }, storedOnline] = await Promise.all([
          supabase.auth.getSession(),
          AsyncStorage.getItem(ONLINE_KEY),
        ]);
        if (!mounted) return;
        setSession(data.session);
        setOnlineState(storedOnline === '1');
        const uid = data.session?.user?.id;
        if (uid) {
          try {
            await loadDriver(uid);
            const [avatar, name] = await Promise.all([
              fetchProfileAvatar(uid),
              fetchProfileName(uid),
            ]);
            if (!mounted) return;
            setAvatarUrl(avatar);
            setFullName(name);
            // Resync présence locale → serveur
            if (storedOnline === '1') {
              void supabase.rpc('set_driver_online', { p_online: true });
            }
          } catch {
            setDriver(null);
          }
        }
      } catch (e) {
        console.warn('[Auth] init failed', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next?.user?.id) {
        try {
          await loadDriver(next.user.id);
          const [avatar, name] = await Promise.all([
            fetchProfileAvatar(next.user.id),
            fetchProfileName(next.user.id),
          ]);
          setAvatarUrl(avatar);
          setFullName(name);
        } catch {
          setDriver(null);
        }
      } else {
        setDriver(null);
        setAvatarUrl(null);
        setFullName(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadDriver]);

  const setOnline = useCallback(async (value: boolean) => {
    setOnlineState(value);
    await AsyncStorage.setItem(ONLINE_KEY, value ? '1' : '0');
    try {
      const { error } = await supabase.rpc('set_driver_online', { p_online: value });
      if (error) console.warn('[Auth] set_driver_online', error.message);
    } catch (e) {
      console.warn('[Auth] set_driver_online failed', e);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.rpc('set_driver_online', { p_online: false });
    } catch {
      /* ignore */
    }
    await AsyncStorage.setItem(ONLINE_KEY, '0');
    setOnlineState(false);
    await supabase.auth.signOut();
    setDriver(null);
    setAvatarUrl(null);
    setFullName(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      driver,
      avatarUrl,
      fullName,
      loading,
      online,
      setOnline,
      setAvatarUrl,
      refreshDriver,
      refreshProfile,
      signIn,
      signOut,
    }),
    [
      session,
      driver,
      avatarUrl,
      fullName,
      loading,
      online,
      setOnline,
      refreshDriver,
      refreshProfile,
      signIn,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
