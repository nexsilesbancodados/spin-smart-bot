import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthStore {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuth = create<AuthStore>((set) => ({
  session: null,
  user: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (loading) => set({ loading }),
}));

let initialized = false;
export const initAuth = () => {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => {
    useAuth.getState().setSession(data.session);
    useAuth.getState().setLoading(false);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.getState().setSession(session);
    useAuth.getState().setLoading(false);
  });
};

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export const signUp = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const resetPassword = async (email: string): Promise<AuthResult> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
