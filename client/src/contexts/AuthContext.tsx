import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthResponse, Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  userId: string | null;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const client = getSupabaseClient();

    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error("[Dayweave] Unable to restore the Supabase session.", error);
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    userId: session?.user.id ?? null,
    signIn: (email, password) => getSupabaseClient().auth.signInWithPassword({ email, password }),
    signUp: (email, password, displayName) => getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    }),
    signOut: async () => {
      const { error } = await getSupabaseClient().auth.signOut();
      return { error };
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
